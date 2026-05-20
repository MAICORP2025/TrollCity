import React from 'react';
import { Hand } from 'lucide-react';
import { cn } from '../lib/utils';
import type { StagePass } from '../types/broadcast';

interface StagePassRequestButtonProps {
  openPass: StagePass | null;
  isRequested: boolean;
  isOnStage: boolean;
  isLive: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export default function StagePassRequestButton({
  openPass,
  isRequested,
  isOnStage,
  isLoading,
  onClick,
}: StagePassRequestButtonProps) {
    const isFree = !openPass || openPass.price_coins === 0;
  const priceLabel = openPass && openPass.price_coins > 0
    ? `${openPass.price_coins} coins`
    : 'Free';

  if (isRequested || isOnStage) {
    return (
      <button
        disabled
        className={cn(
          'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold',
          'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400',
          'cursor-default'
        )}
      >
        <Hand size={14} />
        {isOnStage ? 'On Stage' : 'Requested'}
      </button>
    );
  }

  if (!openPass) return null;

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold',
        'transition-all duration-200',
        isFree
          ? 'bg-violet-600/90 border border-violet-400/50 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20'
          : 'bg-amber-600/90 border border-amber-400/50 text-white hover:bg-amber-500 shadow-lg shadow-amber-500/20',
        isLoading && 'opacity-60 cursor-wait'
      )}
    >
      <Hand size={14} />
      {isFree ? 'Request Stage Pass' : `Request (${priceLabel})`}
    </button>
  );
}
