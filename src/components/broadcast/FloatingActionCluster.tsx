import React from 'react';
import { Heart, Gift, Share2, MoreVertical } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FloatingActionClusterProps {
  isHost?: boolean;
  isLiked?: boolean;
  likesCount?: number;
  onLike?: () => void;
  onGift?: () => void;
  onShare?: () => void;
  onMenu?: () => void;
  className?: string;
}

export default function FloatingActionCluster({
  isLiked,
  likesCount = 0,
  onLike,
  onGift,
  onShare,
  onMenu,
  className
}: FloatingActionClusterProps) {
  return (
    <div className={cn("flex flex-col gap-4 items-center", className)}>
      
      {/* Like Button */}
      <div className="flex flex-col items-center gap-1">
        <button 
          onClick={onLike}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg backdrop-blur-sm",
            isLiked ? "bg-pink-500 text-white" : "bg-black/40 text-white hover:bg-black/60"
          )}
        >
          <Heart size={20} className={cn(isLiked && "fill-current")} />
        </button>
        <span className="text-[10px] font-bold text-white drop-shadow-md">{likesCount}</span>
      </div>

      {/* Gift Button */}
      <div className="flex flex-col items-center gap-1">
        <button 
          onClick={onGift}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform animate-pulse"
        >
          <Gift size={20} />
        </button>
        <span className="text-[10px] font-bold text-white drop-shadow-md">Gift</span>
      </div>

      {/* Share Button */}
      <div className="flex flex-col items-center gap-1">
        <button 
          onClick={onShare}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform hover:bg-black/60"
        >
          <Share2 size={20} />
        </button>
        <span className="text-[10px] font-bold text-white drop-shadow-md">Share</span>
      </div>

      {/* Menu Button */}
      <button 
        onClick={onMenu}
        className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform hover:bg-black/60"
      >
        <MoreVertical size={20} />
      </button>

    </div>
  );
}
