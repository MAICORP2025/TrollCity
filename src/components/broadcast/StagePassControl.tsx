import React from 'react';
import { PlusCircle, Coins } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StagePassControlProps {
  openCount: number;
  onOpenClick: () => void;
  className?: string;
}

export default function StagePassControl({
  openCount,
  onOpenClick,
  className,
}: StagePassControlProps) {
  return (
    <button
      onClick={onOpenClick}
      className={cn(
        'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold',
        'bg-gradient-to-r from-violet-600 to-purple-600',
        'border border-violet-400/40 text-white',
        'shadow-lg shadow-violet-500/25 hover:shadow-violet-400/40',
        'hover:from-violet-500 hover:to-purple-500 transition-all duration-200',
        'tracking-wide uppercase',
        className
      )}
    >
      <PlusCircle size={15} />
      <span>Open Stage Pass</span>
      {openCount > 0 && (
        <span className="ml-1 flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px]">
          <Coins size={10} className="text-amber-300" />
          {openCount}
        </span>
      )}
    </button>
  );
}
