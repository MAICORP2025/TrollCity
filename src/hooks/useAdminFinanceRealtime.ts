import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// Types for finance data
export interface FinanceSummary {
  users: {
    totalUsers: number
    adminsCount: number
    pendingApps: number
    pendingPayouts: number
    trollOfficers: number
    aiFlags: number
  }
  economy: {
    coinSalesRevenue: number
    totalPayouts: number
    feesCollected: number
    platformProfit: number
    purchasedCoins: number
    earnedCoins: number
    freeCoins: number
    totalCoinsInCirculation: number
    totalValue: number
    giftCoins: number
    appSponsoredGifts: number
    savPromoCount: number
  }
  financial: {
    total_liability_coins: number
    total_platform_profit_usd: number
    kick_ban_revenue: number
  }
  lastUpdated: string
}

export interface Transaction {
  id: string
  user_id: string
  transaction_type: string
  amount: number
  description: string
  payment_method?: string
  external_transaction_id?: string
  metadata?: any
  created_at: string
}

export interface CoinTransaction {
  id: string
  user_id: string
  type: string
  amount: number
  description: string
  platform_profit_usd?: number
  metadata?: any
  created_at: string
}

export interface PayoutRequest {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
}

export interface Cashout {
  id: string
  user_id: string
  amount: number
  status: string
  created_at: string
}

// Hook for admin finance realtime data
export function useAdminFinanceRealtime() {
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  // Main finance summary query from view
  const {
    data: financeSummary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary
  } = useQuery({
    queryKey: ['admin-finance-summary'],
    queryFn: async (): Promise<FinanceSummary> => {
      const { data, error } = await supabase
        .from('admin_finance_summary')
        .select('*')
        .single()
      if (error) throw error

      // Transform view data to FinanceSummary interface
      return {
        users: {
          totalUsers: data.total_users || 0,
          adminsCount: data.admin_count || 0,
          pendingApps: data.pending_applications || 0,
          pendingPayouts: data.pending_payouts || 0,
          trollOfficers: data.troll_officer_count || 0,
          aiFlags: data.ai_flag_count || 0,
        },
        economy: {
          coinSalesRevenue: data.coin_sales_revenue || 0,
          totalPayouts: data.total_payouts || 0,
          feesCollected: data.fees_collected || 0,
          platformProfit: data.platform_profit || 0,
          purchasedCoins: data.purchased_coins || 0,
          earnedCoins: data.earned_coins || 0,
          freeCoins: data.free_coins || 0,
          totalCoinsInCirculation: data.total_troll_coins || 0, // Using troll_coins as circulation
          totalValue: (data.total_troll_coins || 0) / 100, // Assuming $1 = 100 coins
          giftCoins: data.gift_coins || 0,
          appSponsoredGifts: data.app_sponsored_gifts || 0,
          savPromoCount: 0, // Not in view, can add later if needed
        },
        financial: {
          total_liability_coins: data.total_liability_coins || 0,
          total_platform_profit_usd: data.platform_profit || 0,
          kick_ban_revenue: 0, // Not in view, can add later if needed
        },
        lastUpdated: data.last_updated || new Date().toISOString(),
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // 30 seconds
  })

  // Finance feed query from view
  const {
    data: financeFeed,
    isLoading: feedLoading,
    refetch: refetchFeed
  } = useQuery({
    queryKey: ['admin-finance-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_finance_feed')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 1 * 60 * 1000,
  })

  // Separate queries for detailed data if needed
  const transactions = financeFeed?.filter(item => item.record_type === 'transaction') || []
  const coinTransactions = financeFeed?.filter(item => item.record_type === 'coin_transaction') || []

  // Payout requests query
  const {
    data: payoutRequests,
    isLoading: payoutRequestsLoading,
    refetch: refetchPayoutRequests
  } = useQuery({
    queryKey: ['admin-payout-requests'],
    queryFn: async (): Promise<PayoutRequest[]> => {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 1 * 60 * 1000,
  })

  // Cashouts query
  const {
    data: cashouts,
    isLoading: cashoutsLoading,
    refetch: refetchCashouts
  } = useQuery({
    queryKey: ['admin-cashouts'],
    queryFn: async (): Promise<Cashout[]> => {
      const { data, error } = await supabase
        .from('cashouts')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    staleTime: 1 * 60 * 1000,
  })

  // Setup realtime subscriptions
  useEffect(() => {
    const channels = [
      supabase
        .channel('admin-finance-transactions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-finance-summary'] })
          queryClient.invalidateQueries({ queryKey: ['admin-finance-feed'] })
          setLastSync(new Date())
        })
        .subscribe(),

      supabase
        .channel('admin-finance-coin-transactions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'coin_transactions' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-finance-summary'] })
          queryClient.invalidateQueries({ queryKey: ['admin-finance-feed'] })
          setLastSync(new Date())
        })
        .subscribe(),

      supabase
        .channel('admin-finance-payout-requests')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payout_requests' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-finance-summary'] })
          queryClient.invalidateQueries({ queryKey: ['admin-finance-feed'] })
          queryClient.invalidateQueries({ queryKey: ['admin-payout-requests'] })
          setLastSync(new Date())
        })
        .subscribe(),

      supabase
        .channel('admin-finance-cashouts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cashout_requests' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-finance-summary'] })
          queryClient.invalidateQueries({ queryKey: ['admin-finance-feed'] })
          queryClient.invalidateQueries({ queryKey: ['admin-cashouts'] })
          setLastSync(new Date())
        })
        .subscribe(),

      supabase
        .channel('admin-finance-user-profiles')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
          queryClient.invalidateQueries({ queryKey: ['admin-finance-summary'] })
          queryClient.invalidateQueries({ queryKey: ['admin-finance-feed'] })
          setLastSync(new Date())
        })
        .subscribe(),
    ]

    setIsConnected(true)

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel))
      setIsConnected(false)
    }
  }, [queryClient])

  // Manual refresh function
  const refreshFinance = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-finance-summary'] })
    queryClient.invalidateQueries({ queryKey: ['admin-finance-feed'] })
    queryClient.invalidateQueries({ queryKey: ['admin-payout-requests'] })
    queryClient.invalidateQueries({ queryKey: ['admin-cashouts'] })
    setLastSync(new Date())
  }

  // Reconciliation check
  const checkReconciliation = () => {
    if (!financeSummary || !coinTransactions || !payoutRequests) return null

    // Check if coin_transactions totals match summary
    const ledgerPurchases = coinTransactions
      .filter(tx => tx.type === 'purchase')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)

    const summaryPurchasedCoins = financeSummary.economy.purchasedCoins
    const purchasesMatch = Math.abs(ledgerPurchases - summaryPurchasedCoins) < 0.01

    // Check payouts
    const actualPayouts = payoutRequests
      .filter(p => p.status === 'paid' || p.status === 'approved')
      .reduce((sum, p) => sum + (p.amount || 0), 0)

    const summaryPayouts = financeSummary.economy.totalPayouts
    const payoutsMatch = Math.abs(actualPayouts - summaryPayouts) < 0.01

    // Check user balances vs ledger
    const ledgerBalance = coinTransactions
      .reduce((sum, tx) => {
        if (tx.type === 'purchase' || tx.type === 'earning' || tx.type === 'free' || tx.type === 'gift') {
          return sum + (tx.amount || 0)
        } else if (tx.type === 'cashout') {
          return sum - (tx.amount || 0)
        }
        return sum
      }, 0)

    const profileBalance = financeSummary.financial.total_liability_coins
    const balancesMatch = Math.abs(ledgerBalance - profileBalance) < 0.01

    return {
      purchasesMatch,
      payoutsMatch,
      balancesMatch,
      discrepancies: {
        purchases: ledgerPurchases - summaryPurchasedCoins,
        payouts: actualPayouts - summaryPayouts,
        balances: ledgerBalance - profileBalance,
      }
    }
  }

  const reconciliation = checkReconciliation()

  return {
    // Data
    financeSummary,
    financeFeed,
    transactions,
    coinTransactions,
    payoutRequests,
    cashouts,

    // Loading states
    isLoading: summaryLoading || feedLoading || payoutRequestsLoading || cashoutsLoading,
    summaryLoading,
    feedLoading,
    payoutRequestsLoading,
    cashoutsLoading,

    // Errors
    summaryError,

    // Realtime status
    isConnected,
    lastSync,

    // Actions
    refreshFinance,
    refetchSummary,
    refetchFeed,
    refetchPayoutRequests,
    refetchCashouts,

    // Reconciliation
    reconciliation,
  }
}