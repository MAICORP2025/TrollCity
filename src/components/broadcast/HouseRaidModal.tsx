import React from 'react'
import { 
  Home, Wrench, Hammer, AlertTriangle, Shield, 
  Coins, DollarSign, RefreshCw
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../lib/store'

interface House {
  id: string
  condition: number
  upgrade_level?: number
  house_style?: string
  owner_user_id: string
}

interface HouseRaidModalProps {
  isOpen: boolean
  onClose: () => void
  house: House | null
  onRaid: () => Promise<void>
  onRepair: () => Promise<void>
  raiding: boolean
  repairing: boolean
  isRaided?: boolean
  hasInsurance?: boolean
  repairCost?: number
}

export default function HouseRaidModal({
  isOpen,
  onClose,
  house,
  onRaid,
  onRepair,
  raiding,
  repairing,
  isRaided,
  hasInsurance,
  repairCost = 200,
}: HouseRaidModalProps) {
  const { profile } = useAuthStore()
  const isStaff = profile?.is_admin || profile?.is_troll_officer || profile?.role === 'admin'

  const coinsNeeded = Math.max(0, repairCost - (profile?.troll_coins || 0))
  const canAffordRepair = (profile?.troll_coins || 0) >= repairCost

  // Calculate cash value: 100 Troll Coins = $1, so condition% / 100 = dollar amount
  const houseValue = house?.condition !== undefined
    ? Math.round((house.condition || 100) / 100)
    : 0

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { e.stopPropagation(); onClose() }}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl',
              isRaided ? 'bg-red-500/20' : 'bg-blue-500/20'
            )}>
              <Home className={cn('h-6 w-6', isRaided ? 'text-red-400' : 'text-blue-400')} />
            </div>
            <div>
              <h2 className="font-bold text-white text-lg">
                {isRaided ? 'House Raided!' : 'Property Status'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isRaided ? 'This house needs repair' : 'Ready for raid'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Property Info */}
          {house && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-zinc-500">Condition</p>
                <p className={cn(
                  'text-2xl font-black',
                  house.condition < 50 ? 'text-red-400' :
                  house.condition < 85 ? 'text-yellow-400' : 'text-emerald-400'
                )}>
                  {house.condition}%
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-zinc-500">Level</p>
                <p className="text-2xl font-black text-white">{house.upgrade_level || 1}</p>
              </div>
            </div>
          )}

          {/* Cash Value */}
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-cyan-400" />
                <span className="text-sm font-medium text-cyan-200">Cash Value</span>
              </div>
              <span className="text-xl font-bold text-cyan-100">${houseValue.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Based on {house?.condition || 0}% condition (100 coins = $1)
            </p>
          </div>

          {/* Insurance Status */}
          {hasInsurance && (
            <div className="flex items-center gap-3 rounded-xl border border-green-400/30 bg-green-500/10 p-4">
              <Shield className="h-5 w-5 text-green-400" />
              <div>
                <p className="font-bold text-green-300">Insurance Active</p>
                <p className="text-xs text-green-200/80">Damage will be partially covered</p>
              </div>
            </div>
          )}

          {/* Raid Cost Info */}
          {!isRaided && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-red-400" />
                  <span className="text-sm font-medium text-red-200">Raid Cost</span>
                </div>
                <span className="text-xl font-bold text-red-100">100 TC</span>
              </div>
            </div>
          )}

          {/* Repair Info */}
          {isRaided && (
            <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-200">Repair Cost</span>
                </div>
                <span className="text-xl font-bold text-yellow-100">{repairCost} TC</span>
              </div>
              {!canAffordRepair && (
                <p className="text-xs text-yellow-300">
                  Need {coinsNeeded} more coins to repair
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-3">
            {isRaided ? (
              <button
                onClick={onRepair}
                disabled={repairing || (!hasInsurance && !canAffordRepair) || isStaff}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold text-white transition-all',
                  repairing || (!hasInsurance && !canAffordRepair) || isStaff
                    ? 'cursor-not-allowed bg-gray-600'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500'
                )}
              >
                <Wrench className="h-5 w-5" />
                {repairing 
                  ? 'Repairing...' 
                  : `Repair House (${repairCost} TC${hasInsurance ? ' Insured' : ''})`}
              </button>
            ) : (
              <button
                onClick={onRaid}
                disabled={raiding || isStaff}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold text-white transition-all',
                  raiding || isStaff
                    ? 'cursor-not-allowed bg-gray-600'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600'
                )}
              >
                <Hammer className="h-5 w-5" />
                {raiding ? 'Raiding...' : 'Raid House (100 TC)'}
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}