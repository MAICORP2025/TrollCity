import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PrideChallenges from '@/components/home/PrideChallenges';

export default function PrideChallengesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050715] text-white">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#050715]/95 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-sm font-black tracking-tight">Pride Challenges</h1>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <PrideChallenges compact={false} />
      </div>
    </div>
  );
}
