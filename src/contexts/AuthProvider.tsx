import React, { useEffect } from 'react'
import { initAuthAndData, useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { useBackgroundSessionRefresh } from '../hooks/useBackgroundSessionRefresh'

const isNoOpProfilePatch = (current: any, next: any) => {
  if (!current || !next) return false
  return (
    current.troll_coins === next.troll_coins &&
    current.paid_coin_balance === next.paid_coin_balance &&
    current.free_coin_balance === next.free_coin_balance &&
    current.credit_score === next.credit_score &&
    current.role === next.role &&
    current.is_admin === next.is_admin &&
    current.updated_at === next.updated_at
  )
}

// Placeholder auth provider to match desired provider stack.
// Auth state is managed via zustand in useAuthStore; this wrapper keeps provider structure consistent.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  useEffect(() => {
    void initAuthAndData()
  }, [])

  // Real-time balance updates for the current user
  useEffect(() => {
    if (!userId) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const channel = supabase
      .channel(`profile-changes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          try {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
              try {
                const next = (payload as any)?.new
                if (!next || next.id !== userId) {
                  void refreshProfile()
                  return
                }

                const current = useAuthStore.getState().profile
                if (isNoOpProfilePatch(current, next)) {
                  console.debug('[ProfileRealtime] Ignoring duplicate/no-op profile patch')
                  return
                }

                // Merge realtime payload into store without a refetch to avoid loops/churn
                useAuthStore.getState().setProfile({ ...(current as any), ...(next as any) })
              } catch {
                void refreshProfile()
              }
            }, 250)
          } catch {
            void refreshProfile()
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel);
    };
  }, [userId, refreshProfile]);

  return (
    <>
      <BackgroundSessionRefresh />
      {children}
    </>
  )
}

function BackgroundSessionRefresh() {
  useBackgroundSessionRefresh()
  return null
}
