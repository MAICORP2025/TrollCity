import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface DashboardMetrics {
  coinRevenue: number
  coinsSold: number
  totalUsers: number
  activeStreams: number
  pendingApplications: number
  trollOfficers: number
  platformProfit: number
  coinsInCirculation: number
}

export function useAdminDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    coinRevenue: 0,
    coinsSold: 0,
    totalUsers: 0,
    activeStreams: 0,
    pendingApplications: 0,
    trollOfficers: 0,
    platformProfit: 0,
    coinsInCirculation: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const results = await Promise.allSettled([
        loadCoinPurchaseMetrics(),
        loadUserMetrics(),
        loadStreamMetrics(),
        loadCoinsInCirculation(),
      ])

      const metricsData = results.reduce((acc, result, index) => {
        if (result.status === 'fulfilled') {
          Object.assign(acc, result.value)
        } else {
          console.warn(`[AdminDashboardMetrics] Failed to load metric set ${index}:`, result.reason)
        }
        return acc
      }, {} as Partial<DashboardMetrics>)

      setMetrics((prev) => ({ ...prev, ...metricsData }))
    } catch (err) {
      console.error('[AdminDashboardMetrics] Error loading metrics:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  async function loadCoinPurchaseMetrics(): Promise<Partial<DashboardMetrics>> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, coins_used, description, metadata')
        .or([
          'transaction_type.eq.purchase',
          'type.eq.purchase',
          'description.ilike.%PayPal purchase%',
          'description.ilike.%coin%',
          'metadata->>paypal_capture_id.not.is.null',
          'metadata->>paypal_order_id.not.is.null',
          'metadata->>package_id.not.is.null',
        ].join(','))

      if (error) throw error

      let totalRevenue = 0
      let totalCoins = 0

      for (const tx of data || []) {
        const amount = Number(tx.amount || 0)
        totalRevenue += amount

        const meta = tx.metadata || {}
        const metadataCoins =
          Number(meta.coins_awarded || 0) ||
          Number(meta.coin_amount || 0) ||
          Number(meta.coins || 0)

        if (metadataCoins > 0) {
          totalCoins += metadataCoins
        } else {
          const coinsUsed = Number(tx.coins_used || 0)
          if (coinsUsed > 0) {
            totalCoins += coinsUsed
          } else {
            const match = String(tx.description || '').match(/(\d[\d,]*)\s*coins?/i)
            if (match) {
              totalCoins += Number(match[1].replace(/,/g, ''))
            } else {
              totalCoins += Math.round(amount * 100)
            }
          }
        }
      }

      if (import.meta.env.DEV) {
        console.log('[AdminDashboardMetrics] Coin purchase metrics:', { totalRevenue, totalCoins })
      }

      return {
        coinRevenue: totalRevenue,
        coinsSold: totalCoins,
        platformProfit: totalRevenue,
      }
    } catch (err) {
      console.error('[AdminDashboardMetrics] Failed to load coin purchase metrics:', err)
      return {}
    }
  }

  async function loadUserMetrics(): Promise<Partial<DashboardMetrics>> {
    try {
      const [usersResult, officersResult] = await Promise.allSettled([
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .in('role', ['troll_officer', 'lead_troll_officer', 'officer', 'lead_officer']),
      ])

      let totalUsers = 0
      let trollOfficers = 0

      if (usersResult.status === 'fulfilled') {
        totalUsers = usersResult.value.count || 0
      }

      if (officersResult.status === 'fulfilled') {
        trollOfficers = officersResult.value.count || 0
      }

      return { totalUsers, trollOfficers, pendingApplications: 0 }
    } catch (err) {
      console.error('[AdminDashboardMetrics] Failed to load user metrics:', err)
      return {}
    }
  }

  async function loadStreamMetrics(): Promise<Partial<DashboardMetrics>> {
    try {
      const { count, error } = await supabase
        .from('streams')
        .select('id', { count: 'exact', head: true })
        .or('is_live.eq.true,status.eq.live')

      if (error) throw error

      return { activeStreams: count || 0 }
    } catch (err) {
      console.error('[AdminDashboardMetrics] Failed to load stream metrics:', err)
      return {}
    }
  }

  async function loadCoinsInCirculation(): Promise<Partial<DashboardMetrics>> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('troll_coins')

      if (error) throw error

      const totalCoins = (data || []).reduce(
        (sum: number, profile: any) => sum + Number(profile.troll_coins || 0),
        0
      )

      return { coinsInCirculation: totalCoins }
    } catch (err) {
      console.error('[AdminDashboardMetrics] Failed to load coins in circulation:', err)
      return {}
    }
  }

  useEffect(() => {
    loadMetrics()

    const interval = setInterval(loadMetrics, 60000)
    return () => clearInterval(interval)
  }, [loadMetrics])

  return { metrics, loading, error, refreshMetrics: loadMetrics }
}