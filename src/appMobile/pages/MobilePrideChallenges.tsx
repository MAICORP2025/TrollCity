import { ArrowLeft } from 'lucide-react';
import PrideChallenges from '@/components/home/PrideChallenges';

interface MobilePrideChallengesProps {
  onBack?: () => void;
}

export default function MobilePrideChallenges({ onBack }: MobilePrideChallengesProps) {
  return (
    <div className="flex h-full flex-col bg-[#050715] text-white">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#050715]/95 px-4 py-3 backdrop-blur-xl">
        {onBack && (
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <h1 className="text-sm font-black tracking-tight">Pride Challenges</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <PrideChallenges compact={false} />
      </div>
    </div>
  );
}
