import React from 'react'
import { Users, DollarSign, Shield, Award, Activity, TrendingUp, Coins, Zap, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'

interface CitySummaryBarProps {
  stats: {
    totalUsers: number
    adminsCount: number
    pendingApps: number
    pendingPayouts: number
    trollOfficers: number
    aiFlags: number
    coinSalesRevenue: number
    totalPayouts: number
    feesCollected: number
    platformProfit: number
    totalCoinsInCirculation: number
    totalValue: number
    purchasedCoins: number
    earnedCoins: number
    freeCoins: number
    giftCoins: number
    appSponsoredGifts: number
    total_liability_coins: number
    total_platform_profit_usd: number
    kick_ban_revenue: number
  }
  liveStreamsCount: number
  financeLoading?: boolean
  isConnected?: boolean
  lastSync?: Date | null
  reconciliation?: {
    revenueMatch: boolean
    payoutsMatch: boolean
    discrepancies: {
      revenue: number
      payouts: number
    }
  } | null
  onRefreshFinance?: () => void
}

export default function CitySummaryBar({ stats, liveStreamsCount }: CitySummaryBarProps) {
  const summaryItems = [
    {
      label: 'Total Citizens',
      value: stats.totalUsers.toLocaleString(),
      icon: <Users className="w-4 h-4" />,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30'
    },
    {
      label: 'Active Streams',
      value: liveStreamsCount.toString(),
      icon: <Activity className="w-4 h-4" />,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/20',
      borderColor: 'border-pink-500/30'
    },
    {
      label: 'Platform Revenue',
      value: `$${stats.coinSalesRevenue.toLocaleString()}`,
      icon: <DollarSign className="w-4 h-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30'
    },
    {
      label: 'Coins in Circulation',
      value: stats.totalCoinsInCirculation.toLocaleString(),
      icon: <Coins className="w-4 h-4" />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30'
    },
    {
      label: 'Pending Applications',
      value: stats.pendingApps.toString(),
      icon: <Shield className="w-4 h-4" />,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30'
    },
    {
      label: 'Troll Officers',
      value: stats.trollOfficers.toString(),
      icon: <Award className="w-4 h-4" />,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30'
    },
    {
      label: 'Platform Profit',
      value: `$${stats.platformProfit.toLocaleString()}`,
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/20',
      borderColor: 'border-emerald-500/30'
    },
    {
      label: 'System Health',
      value: '98.5%',
      icon: <Zap className="w-4 h-4" />,
      color: 'text-lime-400',
      bgColor: 'bg-lime-500/20',
      borderColor: 'border-lime-500/30'
    }
  ]

  return (
    <div className="bg-gradient-to-r from-[#0A0814] via-[#1a0b2e] to-[#0A0814] border-b border-[#2C2C2C] p-4 mb-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
            City Summary
          </h2>
          <div className="text-xs text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {summaryItems.map((item, index) => (
            <div
              key={index}
              className={`relative ${item.bgColor} ${item.borderColor} border rounded-lg p-3 backdrop-blur-sm hover:scale-105 transition-all duration-200 group`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`${item.color} group-hover:animate-pulse`}>
                  {item.icon}
                </div>
                <span className="text-xs font-medium text-gray-300 truncate">
                  {item.label}
                </span>
              </div>
              <div className="text-lg font-bold text-white">
                {item.value}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
            </div>
          ))}
        </div>

        {/* Finance Status Bar */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-400" />
              )}
              <span className="text-xs text-gray-400">
                {isConnected ? 'Realtime Connected' : 'Realtime Disconnected'}
              </span>
            </div>

            {/* Last Sync */}
            {lastSync && (
              <div className="text-xs text-gray-400">
                Last sync: {lastSync.toLocaleTimeString()}
              </div>
            )}

            {/* Loading */}
            {financeLoading && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-xs text-gray-400">Syncing...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Reconciliation Alert */}
            {reconciliation && (!reconciliation.revenueMatch || !reconciliation.payoutsMatch) && (
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs">Data mismatch detected</span>
              </div>
            )}

            {/* Refresh Button */}
            {onRefreshFinance && (
              <button
                onClick={onRefreshFinance}
                className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-500/30 transition-colors"
                disabled={financeLoading}
              >
                <RefreshCw className={`w-3 h-3 ${financeLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
