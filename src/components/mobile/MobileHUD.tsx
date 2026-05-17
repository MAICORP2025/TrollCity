import React from 'react';
import { Coins } from 'lucide-react';

interface MobileHUDProps {
  compact?: boolean;
}

export default function MobileHUD({ compact }: MobileHUDProps) {
  return (
    <div className={`flex items-center gap-2 ${compact ? 'scale-75' : ''}`}>
      <div className="flex items-center gap-1 bg-zinc-900/80 backdrop-blur-sm rounded-full px-3 py-1 border border-yellow-500/30">
        <Coins size={16} className="text-yellow-400" />
        <span className="text-yellow-400 font-bold text-sm">--</span>
      </div>
    </div>
  );
}
