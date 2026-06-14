import React, { useState } from 'react'
import { HardDrive, AlertTriangle, ChevronDown, ChevronUp, Trash2, Download, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStorageUsage } from '@/hooks/useStorageUsage'

interface StorageIndicatorProps {
  userId: string | null
  storageType?: 'broadcast' | 'hytro_gaming'
  className?: string
}

function formatGB(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(1)} GB`
}

function formatTierRange(tierStartGB: number, tierEndGB: number): string {
  if (!isFinite(tierEndGB)) {
    return `${tierStartGB.toFixed(0)} GB+`
  }
  return `${tierStartGB.toFixed(0)}–${tierEndGB.toFixed(0)} GB`
}

export function StorageIndicator({ userId, storageType = 'broadcast', className }: StorageIndicatorProps) {
  const { storage, loading, refresh } = useStorageUsage(userId)
  const [expanded, setExpanded] = useState(false)

  if (!userId || loading || !storage) {
    return null
  }

  const statusColor = storage.status === 'warning' ? 'text-amber-300' : 'text-cyan-300'
  const borderColor = storage.status === 'warning' ? 'border-amber-400/30' : 'border-cyan-400/30'
  const bgColor = storage.status === 'warning' ? 'bg-amber-500/10' : 'bg-cyan-500/10'

  const getCategoryLabel = (category: string) => {
    if (storageType === 'hytro_gaming') {
      if (category === 'Broadcast Recordings') return 'Game Files'
      if (category === 'Screenshots') return 'Screenshots'
      if (category === 'Videos') return 'Videos'
    }
    return category
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition-all',
          borderColor,
          bgColor,
          statusColor,
        )}
      >
        {storage.status === 'warning' && <AlertTriangle className="h-3.5 w-3.5" />}
        <HardDrive className="h-3.5 w-3.5" />
        <span>{formatGB(storage.totalBytes)}</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl z-50">
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white">Storage Breakdown</h4>
              <button
                type="button"
                onClick={refresh}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Tier: {formatTierRange(storage.tierStartGB, storage.tierEndGB)} •{' '}
              {storage.monthlyFee} Coins/month
              {storage.plan?.isActive && ` • Plan active`}
            </p>
          </div>

          <div className="space-y-2">
            {storage.breakdown.map((item) => {
              if (storageType === 'hytro_gaming' && 
                  !['Broadcast Recordings', 'Screenshots', 'Videos', 'Other'].includes(item.category)) {
                return null
              }
              if (storageType === 'broadcast' && 
                  !['Broadcast Recordings', 'Hytro Games Files', 'Screenshots', 'Videos', 
                    'Troll Wall Media', 'Profile Media', 'Stream Thumbnails', 'Other'].includes(item.category)) {
                return null
              }
              return (
                <div key={item.category} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{getCategoryLabel(item.category)}</span>
                  <span className="font-bold text-white">{formatGB(item.bytes)}</span>
                </div>
              )
            })}
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-500">Total Storage Used</span>
              <span className="font-bold text-white">{formatGB(storage.totalBytes)}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  storage.status === 'warning' ? 'bg-amber-400' : 'bg-cyan-400',
                )}
                style={{ width: `${Math.min(100, storage.percentage)}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold text-slate-300 transition hover:bg-white/10"
            >
              <Download className="h-3 w-3" />
              Download
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-red-400/20 bg-red-500/5 px-3 py-2 text-[10px] font-bold text-red-300 transition hover:bg-red-500/10"
            >
              <Trash2 className="h-3 w-3" />
              Delete Old
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default StorageIndicator