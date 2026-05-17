import React, { useMemo, useState } from 'react'
import {
  DollarSign,
  TrendingUp,
  Coins,
  CreditCard,
  PiggyBank,
  BarChart3,
  RefreshCw,
  Eye,
  EyeOff,
  Target,
  Wallet,
  Banknote,
  Calculator,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

type MetricFormat = 'currency' | 'number'

interface Stats {
  coinSalesRevenue: number
  totalPayouts: number
  feesCollected: number
  platformProfit: number
  totalCoinsInCirculation: number
  purchasedCoins: number
  earnedCoins: number
  freeCoins: number
  giftCoins: number
  totalLiabilityCoins?: number
  totalPlatformProfitUsd?: number
  total_liability_coins?: number
  total_platform_profit_usd?: number
}

interface EconomySummary {
  trollCoins?: {
    totalPurchased?: number
    outstandingLiability?: number
  }
  broadcasters?: {
    totalUsdOwed?: number
  }
}

interface FinanceEconomyCenterProps {
  stats: Stats
  economySummary: EconomySummary | null
  economyLoading: boolean
  onLoadEconomySummary: () => Promise<void> | void
}

interface MetricCardProps {
  label: string
  value: number
  format: MetricFormat
  icon: React.ReactNode
  color: string
  bgColor: string
  hidden?: boolean
}

function formatValue(value: number, format: MetricFormat): string {
  const safeValue = Number.isFinite(value) ? value : 0

  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(safeValue)
  }

  return new Intl.NumberFormat('en-US').format(safeValue)
}

function MetricCard({
  label,
  value,
  format,
  icon,
  color,
  bgColor,
  hidden = false
}: MetricCardProps) {
  return (
    <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`${bgColor} p-1 rounded`}>
          <div className={color}>{icon}</div>
        </div>

        <span className="text-xs font-medium text-gray-300">
          {label}
        </span>
      </div>

      <div className="text-lg font-bold text-white">
        {hidden ? '••••••' : formatValue(value, format)}
      </div>
    </div>
  )
}

export default function FinanceEconomyCenter({
  stats,
  economySummary,
  economyLoading,
  onLoadEconomySummary
}: FinanceEconomyCenterProps) {
  const [expandedSection, setExpandedSection] = useState<
    'financial-overview' | 'coin-economy' | null
  >('financial-overview')

  const [showSensitiveData, setShowSensitiveData] = useState(false)

  const toggleSection = (
    section: 'financial-overview' | 'coin-economy'
  ) => {
    setExpandedSection((prev) =>
      prev === section ? null : section
    )
  }

  const financialMetrics = useMemo(
    () => [
      {
        label: 'Coin Sales Revenue',
        value: stats.coinSalesRevenue,
        format: 'currency' as const,
        icon: <DollarSign className="w-4 h-4" />,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20'
      },
      {
        label: 'Total Payouts',
        value: stats.totalPayouts,
        format: 'currency' as const,
        icon: <CreditCard className="w-4 h-4" />,
        color: 'text-red-400',
        bgColor: 'bg-red-500/20'
      },
      {
        label: 'Platform Profit',
        value: stats.platformProfit,
        format: 'currency' as const,
        icon: <TrendingUp className="w-4 h-4" />,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20'
      },
      {
        label: 'Processing Fees',
        value: stats.feesCollected,
        format: 'currency' as const,
        icon: <Calculator className="w-4 h-4" />,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20'
      }
    ],
    [stats]
  )

  const coinMetrics = useMemo(
    () => [
      {
        label: 'Coins in Circulation',
        value: stats.totalCoinsInCirculation,
        format: 'number' as const,
        icon: <Coins className="w-4 h-4" />,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20'
      },
      {
        label: 'Purchased Coins',
        value: stats.purchasedCoins,
        format: 'number' as const,
        icon: <Wallet className="w-4 h-4" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20'
      },
      {
        label: 'Earned Coins',
        value: stats.earnedCoins,
        format: 'number' as const,
        icon: <Target className="w-4 h-4" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20'
      },
      {
        label: 'Free Coins',
        value: stats.freeCoins,
        format: 'number' as const,
        icon: <PiggyBank className="w-4 h-4" />,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/20'
      }
    ],
    [stats]
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

      {/* Financial Overview */}
      <section className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">

        <button
          type="button"
          onClick={() => toggleSection('financial-overview')}
          className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-green-400" />
            </div>

            <div className="text-left">
              <h3 className="font-semibold text-white">
                Financial Overview
              </h3>

              <p className="text-xs text-gray-400">
                Revenue, payouts & profitability
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowSensitiveData((prev) => !prev)
              }}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle sensitive financial data"
            >
              {showSensitiveData ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>

            {expandedSection === 'financial-overview' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>

        {expandedSection === 'financial-overview' && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {financialMetrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  {...metric}
                  hidden={!showSensitiveData}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Coin Economy */}
      <section className="bg-[#141414] border border-[#2C2C2C] rounded-xl overflow-hidden">

        <button
          type="button"
          onClick={() => toggleSection('coin-economy')}
          className="w-full flex items-center justify-between p-4 hover:bg-[#1a1a1a] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-500/20 border border-yellow-500/30 rounded-lg flex items-center justify-center">
              <Coins className="w-4 h-4 text-yellow-400" />
            </div>

            <div className="text-left">
              <h3 className="font-semibold text-white">
                Coin Economy Dashboard
              </h3>

              <p className="text-xs text-gray-400">
                Coin circulation & distribution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onLoadEconomySummary()
              }}
              disabled={economyLoading}
              className="p-1 text-gray-400 hover:text-white disabled:opacity-50"
              aria-label="Refresh economy summary"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  economyLoading ? 'animate-spin' : ''
                }`}
              />
            </button>

            {expandedSection === 'coin-economy' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>

        {expandedSection === 'coin-economy' && (
          <div className="px-4 pb-4">

            <div className="grid grid-cols-2 gap-3 mb-4">
              {coinMetrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  {...metric}
                />
              ))}
            </div>

            {economySummary && (
              <div className="bg-[#0A0814] border border-[#2C2C2C] rounded-lg p-4">

                <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-cyan-400" />
                  Economy Summary
                </h4>

                <div className="space-y-2 text-sm">

                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Coins Purchased
                    </span>

                    <span className="text-white font-medium">
                      {formatValue(
                        economySummary.trollCoins?.totalPurchased ?? 0,
                        'number'
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Outstanding Liability
                    </span>

                    <span className="text-white font-medium">
                      {formatValue(
                        economySummary.trollCoins?.outstandingLiability ?? 0,
                        'currency'
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">
                      Broadcaster Payouts
                    </span>

                    <span className="text-white font-medium">
                      {formatValue(
                        economySummary.broadcasters?.totalUsdOwed ?? 0,
                        'currency'
                      )}
                    </span>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}