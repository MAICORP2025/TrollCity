import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/supabaseClient'
import { mergeBadges, MergedBadge, BadgeCatalogRow, UserBadgeRow } from '../badges/mergeBadges'

export function useBadges(userId?: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<BadgeCatalogRow[]>([])
  const [userBadges, setUserBadges] = useState<UserBadgeRow[]>([])

  const fetchBadges = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userPromise = userId
        ? supabase
            .from('user_badges')
            .select('badge_id, earned_at')
            .eq('user_id', userId)
        : Promise.resolve({ data: [], error: null })

      const [catalogResp, userResp] = await Promise.all([
        supabase
          .from('badge_catalog')
          .select('id, slug, name, description, category, icon_url, rarity, sort_order, is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        userPromise,
      ])

      if (catalogResp.error) throw catalogResp.error
      if (userResp.error) throw userResp.error

      setCatalog((catalogResp.data || []) as BadgeCatalogRow[])
      setUserBadges((userResp.data || []) as UserBadgeRow[])
    } catch (e: any) {
      setError(e?.message || 'Failed to load badges')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchBadges()
  }, [fetchBadges])

  const merged = useMemo<MergedBadge[]>(
    () => mergeBadges(catalog, userBadges),
    [catalog, userBadges]
  )

  return { loading, error, catalog: merged, refresh: fetchBadges }
}
