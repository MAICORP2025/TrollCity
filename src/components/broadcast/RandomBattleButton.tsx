import React from 'react'
import { Swords, Zap, Trophy } from 'lucide-react'
import { cn } from '../../lib/utils'

type QueuePhase = 'regular' | 'queue' | 'starting' | 'active' | 'ended'

interface RandomBattleButtonProps {
  phase: QueuePhase
  isBroadcaster: boolean
  isBusy?: boolean
  onStartQueue?: () => void
  onStopQueue?: () => void
  className?: string
}

export default function RandomBattleButton({
  phase,
  isBroadcaster,
  isBusy = false,
  onStartQueue,
  onStopQueue,
  className = '',
}: RandomBattleButtonProps) {
  const isActive = phase === 'active' || phase === 'starting'
  const isQueue = phase === 'queue'

  const handleClick = () => {
    if (isQueue && isBroadcaster && onStopQueue) {
      onStopQueue()
      return
    }
    if ((phase === 'regular' || phase === 'ended') && isBroadcaster && onStartQueue) {
      onStartQueue()
    }
  }

  const canAct = isBroadcaster && (isQueue || phase === 'regular' || phase === 'ended') && !isBusy

  const { icon: Icon, ring, bg } = isActive
    ? { icon: Swords, ring: 'border-fuchsia-400/50', bg: 'bg-fuchsia-600/30' }
    : isQueue
      ? { icon: Zap, ring: 'border-amber-400/50', bg: 'bg-amber-500/25' }
      : { icon: Trophy, ring: 'border-indigo-400/40', bg: 'bg-indigo-500/25' }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!canAct}
      title={
        isActive
          ? 'Random battle active'
          : isQueue
            ? 'Stop random battle queue'
            : 'Start random battle queue'
      }
      className={cn(
        'relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border backdrop-blur-md transition active:scale-95',
        ring,
        bg,
        canAct ? 'cursor-pointer hover:brightness-110' : 'cursor-default',
        className,
      )}
    >
      {isActive && (
        <span className="absolute h-2 w-2 rounded-full bg-red-500 animate-ping" />
      )}
      <Icon className="h-4 w-4 text-white" />
    </button>
  )
}
