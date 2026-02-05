import React from 'react';
import { UserPlus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SeatSession } from '../../hooks/useStreamSeats';

interface ParticipantStripProps {
  seats: Record<number, SeatSession>;
  onJoinRequest?: (index: number) => void;
  className?: string;
}

export default function ParticipantStrip({
  seats,
  onJoinRequest,
  className
}: ParticipantStripProps) {
  // We usually have 6 seats
  const seatIndexes = [1, 2, 3, 4, 5]; 

  return (
    <div className={cn("flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide", className)}>
      {seatIndexes.map((index) => {
          const seat = seats[index];
          return (
            <div key={index} className="flex-shrink-0 flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center overflow-hidden relative">
                    {seat?.user_id ? (
                        <div className="w-full h-full bg-zinc-700 flex items-center justify-center text-xs font-bold">
                            {/* Avatar would go here */}
                            {seat.user_id.slice(0, 2).toUpperCase()}
                        </div>
                    ) : (
                        <button 
                            onClick={() => onJoinRequest?.(index)}
                            className="w-full h-full flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <UserPlus size={18} />
                        </button>
                    )}
                </div>
                {seat?.user_id && (
                    <span className="text-[10px] text-white/80 max-w-[48px] truncate">
                        Guest
                    </span>
                )}
            </div>
          );
      })}
    </div>
  );
}
