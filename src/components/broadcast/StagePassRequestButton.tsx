import React from 'react'
import { Hand, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { StagePass } from '../../types/broadcast'

interface StagePassRequestButtonProps {
  openPass: StagePass | null
  isRequested: boolean
  isOnStage: boolean
  isLive: boolean
  isLoading: boolean
  onClick: (stagePass: StagePass) => void | Promise<void>
}

export default function StagePassRequestButton({
  openPass,
  isRequested,
  isOnStage,
  isLive,
  isLoading,
  onClick,
}: StagePassRequestButtonProps) {
  if (!isLive) {
    return null
  }

  if (isRequested || isOnStage) {
    return (
      <button
        type="button"
        disabled
        className={cn(
          'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold',
          'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400',
          'cursor-default',
        )}
      >
        <Hand size={14} />
        {isOnStage ? 'On Stage' : 'Requested'}
      </button>
    )
  }

  if (!openPass || openPass.status !== 'open') {
    return null
  }

  const priceCoins = Number(openPass.price_coins || 0)
  const isFree = priceCoins === 0
  const priceLabel = priceCoins > 0 ? `${priceCoins} coins` : 'Free'

  const handleClick = () => {
    console.debug('[StagePassRequestButton] clicked open pass', {
      stagePassId: openPass.id,
      stageIndex: openPass.stage_index,
      status: openPass.status,
      streamId: openPass.stream_id,
      priceCoins,
    })

    void onClick(openPass)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold',
        'transition-all duration-200',
        isFree
          ? 'bg-violet-600/90 border border-violet-400/50 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20'
          : 'bg-amber-600/90 border border-amber-400/50 text-white hover:bg-amber-500 shadow-lg shadow-amber-500/20',
        isLoading && 'opacity-60 cursor-wait',
      )}
    >
      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Hand size={14} />}
      {isLoading ? 'Requesting...' : isFree ? 'Request Stage Pass' : `Request (${priceLabel})`}
    </button>
  )
}