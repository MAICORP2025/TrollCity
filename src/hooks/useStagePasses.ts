import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import type { StagePass, StagePassStatus } from '../types/broadcast';

interface UseStagePassesResult {
  stagePasses: StagePass[];
  requests: StagePass[];
  currentUserStagePass: StagePass | null;
  loading: boolean;
  message: string | null;
  openStagePasses: (count: number, priceCoins: number) => Promise<void>;
  requestStagePass: (stagePassId: string) => Promise<{ success: boolean; error?: string }>;
  approveStagePass: (stagePassId: string) => Promise<void>;
  denyStagePass: (stagePassId: string) => Promise<void>;
  removeStageGuest: (stagePassId: string) => Promise<void>;
  loadStagePasses: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useStagePasses(streamId: string | undefined): UseStagePassesResult {
  const { user, profile } = useAuthStore();
  const [stagePasses, setStagePasses] = useState<StagePass[]>([]);
  const [currentUserStagePass, setCurrentUserStagePass] = useState<StagePass | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);

  const openSlots = useCallback((): StagePass[] => {
    return stagePasses.filter(sp => sp.status === 'open');
  }, [stagePasses]);

  const getRequestedSlots = useCallback((): StagePass[] => {
    return stagePasses.filter(sp => sp.status === 'requested');
  }, [stagePasses]);

  const getRequest: UseStagePassesResult['requests'] = stagePasses;

  const requests = stagePasses.filter(sp => sp.status === 'requested');

  const loadStagePasses = useCallback(async () => {
    if (!streamId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stream_stage_passes')
        .select(`
          *,
          user_profile:user_profiles(id, username, avatar_url)
        `)
        .eq('stream_id', streamId)
        .order('stage_index', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      const passes: StagePass[] = (data || []).map((row: any) => ({
        id: row.id,
        stream_id: row.stream_id,
        broadcaster_id: row.broadcaster_id,
        user_id: row.user_id,
        status: row.status,
        stage_index: row.stage_index,
        price_coins: row.price_coins,
        paid_amount: row.paid_amount,
        requested_at: row.requested_at,
        approved_at: row.approved_at,
        went_live_at: row.went_live_at,
        denied_at: row.denied_at,
        removed_at: row.removed_at,
        expired_at: row.expired_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user_profile: row.user_profile ? {
          id: row.user_profile.id,
          username: row.user_profile.username,
          avatar_url: row.user_profile.avatar_url,
        } : undefined,
      }));

      if (!mountedRef.current) return;
      setStagePasses(passes);

      if (user?.id) {
        const mine = passes.find(sp => sp.user_id === user.id && sp.status !== 'open');
        setCurrentUserStagePass(mine || null);
      }
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('[useStagePasses] load error:', err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [streamId, user?.id]);

  // ─── Open Stage Passes ────────────────────────────────────────────────────
  const openStagePasses = useCallback(async (count: number, priceCoins: number) => {
    if (!streamId || !user?.id) return;
    setLoading(true);
    setMessage(null);
    try {
      // Fetch current open count
      const { data: existing } = await supabase
        .from('stream_stage_passes')
        .select('stage_index')
        .eq('stream_id', streamId)
        .eq('status', 'open')
        .order('stage_index', { ascending: true });

      const usedIndices = new Set((existing || []).map((r: any) => r.stage_index));
      const passes: any[] = [];
      let created = 0;
      for (let i = 1; i <= count && created < 5; i++) {
        if (usedIndices.has(i)) continue;
        passes.push({
          stream_id: streamId,
          broadcaster_id: user.id,
          user_id: null,
          status: 'open',
          stage_index: i,
          price_coins: Math.max(0, priceCoins),
          paid_amount: 0,
        });
        created++;
      }

      if (passes.length === 0) {
        setMessage('No slots available.');
        return;
      }

      const { error } = await supabase
        .from('stream_stage_passes')
        .insert(passes);

      if (error) throw error;
      await loadStagePasses();
    } catch (err: any) {
      setMessage(err.message || 'Failed to open Stage Passes');
    } finally {
      setLoading(false);
    }
  }, [streamId, user?.id, loadStagePasses]);

  // ─── Request Stage Pass ───────────────────────────────────────────────────
  const requestStagePass = useCallback(async (stagePassId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.id) return { success: false, error: 'Not logged in' };
    setLoading(true);
    setMessage(null);
    try {
      // Fetch the open slot to check price
      const { data: slot, error: fetchErr } = await supabase
        .from('stream_stage_passes')
        .select('*')
        .eq('id', stagePassId)
        .eq('status', 'open')
        .single();

      if (fetchErr || !slot) {
        return { success: false, error: 'Slot not available' };
      }

      // Deduct coins if price > 0
      if (slot.price_coins > 0) {
        const { error: coinErr } = await supabase.rpc('deduct_troll_coins', {
          p_user_id: user.id,
          p_amount: slot.price_coins,
          p_description: `Stage Pass request for stream ${slot.stream_id}`,
        });
        if (coinErr) {
          return { success: false, error: 'Insufficient coins' };
        }
      }

      const { error: updateErr } = await supabase
        .from('stream_stage_passes')
        .update({
          user_id: user.id,
          status: 'requested',
          requested_at: new Date().toISOString(),
          paid_amount: slot.price_coins,
          updated_at: new Date().toISOString(),
        })
        .eq('id', stagePassId);

      if (updateErr) throw updateErr;
      await loadStagePasses();
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to request Stage Pass';
      setMessage(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadStagePasses]);

  // ─── Approve Stage Pass ────────────────────────────────────────────────────
  const approveStagePass = useCallback(async (stagePassId: string) => {
    if (!user?.id) return;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('stream_stage_passes')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          went_live_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', stagePassId);

      if (error) throw error;
      await loadStagePasses();
    } catch (err: any) {
      setMessage(err.message || 'Failed to approve');
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadStagePasses]);

  // ─── Deny Stage Pass ───────────────────────────────────────────────────────
  const denyStagePass = useCallback(async (stagePassId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('stream_stage_passes')
        .update({
          status: 'denied',
          denied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', stagePassId);

      if (error) throw error;
      await loadStagePasses();
    } catch (err: any) {
      setMessage(err.message || 'Failed to deny');
    } finally {
      setLoading(false);
    }
  }, [loadStagePasses]);

  // ─── Remove Stage Guest ────────────────────────────────────────────────────
  const removeStageGuest = useCallback(async (stagePassId: string) => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase
        .from('stream_stage_passes')
        .update({
          status: 'removed',
          removed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', stagePassId);

      if (error) throw error;
      await loadStagePasses();
    } catch (err: any) {
      setMessage(err.message || 'Failed to remove guest');
    } finally {
      setLoading(false);
    }
  }, [loadStagePasses]);

  // ─── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!streamId) return;
    mountedRef.current = true;

    const channel = supabase
      .channel(`stage-passes:${streamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stream_stage_passes', filter: `stream_id=eq.${streamId}` },
        () => { void loadStagePasses(); }
      )
      .subscribe();

    channelRef.current = channel;
    loadStagePasses();

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [streamId, loadStagePasses]);

  return {
    stagePasses,
    requests,
    currentUserStagePass,
    loading,
    message,
    openStagePasses,
    requestStagePass,
    approveStagePass,
    denyStagePass,
    removeStageGuest,
    loadStagePasses,
    refetch: loadStagePasses,
  };
}
