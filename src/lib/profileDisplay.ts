import type { User } from '@supabase/supabase-js'

export function getProfileDisplayName(profile?: { username?: string | null; display_name?: string | null; email?: string | null } | null, authUser?: User | null): string {
  const username = profile?.username?.trim()
  if (username) return username

  const displayName = profile?.display_name?.trim()
  if (displayName) return displayName

  const email = (profile?.email || authUser?.email || '').trim()
  if (email && email.includes('@')) return email.split('@')[0]

  return 'User'
}
