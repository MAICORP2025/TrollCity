import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';

interface UnderConstructionPageProps {
  pageName: string;
}

export default function UnderConstructionPage({ pageName }: UnderConstructionPageProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white gap-6 px-6">
      {/* Animated construction icon */}
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-2 border-amber-500/30 flex items-center justify-center">
          <Construction size={48} className="text-amber-400 animate-pulse" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
          <span className="text-black text-xs font-black">!</span>
        </div>
      </div>

      <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
        Under Construction
      </h1>

      <p className="text-center text-zinc-400 max-w-md text-sm md:text-base">
        <span className="text-white font-bold">{pageName}</span> is currently being built and is not accessible yet.
        Check back later!
      </p>

      <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full">
        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
        <span className="text-amber-400 text-xs font-bold uppercase tracking-wider">Coming Soon</span>
      </div>

      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold rounded-full transition-all hover:scale-105 shadow-lg shadow-amber-500/20"
      >
        <ArrowLeft size={18} />
        Return Home
      </button>
    </div>
  );
}
