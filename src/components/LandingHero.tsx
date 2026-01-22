import React from 'react';
import { Play, Users, Coins, TrendingUp, Zap, Star } from 'lucide-react';
import TopBroadcasters from './TopBroadcasters';

export default function LandingHero() {
  return (
    <div className="relative w-full h-full min-h-[400px] bg-gradient-to-br from-slate-900 via-purple-900/40 to-slate-900 rounded-3xl overflow-hidden border border-white/10 shadow-[0_20px_70px_rgba(147,51,234,0.3)]">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(147,51,234,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(147,51,234,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          animation: 'grid-flow 20s linear infinite'
        }} />
      </div>

      {/* Gradient Orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-purple-600/30 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-pink-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />

      {/* Main Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 md:p-12">
        {/* Center Stage - Mock Streaming Interface */}
        <div className="w-full max-w-2xl space-y-6">
          {/* Top Bar - Live Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 px-4 py-2 bg-red-600/90 backdrop-blur-sm rounded-full shadow-[0_8px_24px_rgba(239,68,68,0.4)]">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white font-bold text-sm">LIVE</span>
              <span className="text-white/80 text-sm">1.2K watching</span>
            </div>
            
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-semibold text-sm">10.5K</span>
            </div>
          </div>

          {/* Main Video Area Mockup */}
          <div className="relative aspect-video bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            {/* Simulated Video Content */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Giant Play Icon */}
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 rounded-full blur-2xl opacity-50 group-hover:opacity-75 transition-opacity animate-pulse-slow" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(147,51,234,0.6)] group-hover:scale-110 transition-transform cursor-pointer">
                  <Play className="w-12 h-12 text-white ml-1" fill="white" />
                </div>
              </div>
            </div>

            {/* Floating Stats - Animated */}
            <div className="absolute top-4 left-4 animate-float" style={{ animationDelay: '0s' }}>
              <div className="px-4 py-2 bg-purple-600/90 backdrop-blur-sm rounded-xl border border-purple-400/30 shadow-[0_8px_24px_rgba(147,51,234,0.4)]">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm">+50 XP</span>
                </div>
              </div>
            </div>

            <div className="absolute top-20 right-4 animate-float" style={{ animationDelay: '0.5s' }}>
              <div className="px-4 py-2 bg-amber-600/90 backdrop-blur-sm rounded-xl border border-amber-400/30 shadow-[0_8px_24px_rgba(245,158,11,0.4)]">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-white" />
                  <span className="text-white font-bold text-sm">+100</span>
                </div>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 animate-float" style={{ animationDelay: '1s' }}>
              <div className="px-4 py-2 bg-pink-600/90 backdrop-blur-sm rounded-xl border border-pink-400/30 shadow-[0_8px_24px_rgba(236,72,153,0.4)]">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-white" fill="white" />
                  <span className="text-white font-bold text-sm">New Sub!</span>
                </div>
              </div>
            </div>

            <div className="absolute bottom-20 right-4 animate-float" style={{ animationDelay: '1.5s' }}>
              <div className="px-4 py-2 bg-cyan-600/90 backdrop-blur-sm rounded-xl border border-cyan-400/30 shadow-[0_8px_24px_rgba(34,211,238,0.4)]">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-white" fill="white" />
                  <span className="text-white font-bold text-sm">Streak!</span>
                </div>
              </div>
            </div>

            {/* Bottom Chat Bar Mockup */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900/95 to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex-1 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                  <span className="text-slate-400 text-sm">Join the conversation...</span>
                </div>
                <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold text-white text-sm shadow-[0_4px_16px_rgba(147,51,234,0.4)] hover:shadow-[0_6px_20px_rgba(236,72,153,0.5)] transition-all">
                  Send
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Info Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 rounded-full border-2 border-white/20 shadow-[0_8px_24px_rgba(147,51,234,0.4)]" />
              <div>
                <div className="text-white font-bold">@YourUsername</div>
                <div className="text-slate-400 text-sm">Level 25 • 10K Trolls</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-full font-bold text-white shadow-[0_8px_24px_rgba(239,68,68,0.4)] hover:shadow-[0_10px_30px_rgba(249,115,22,0.5)] transition-all hover:scale-105">
                Go Live
              </button>
            </div>
          </div>
        </div>

        {/* Floating UI Elements */}
        <div className="absolute top-8 right-8 hidden lg:block">
          <TopBroadcasters />
        </div>

        <div className="absolute bottom-8 left-8 hidden lg:block animate-float-slow" style={{ animationDelay: '1s' }}>
          <div className="p-4 bg-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.3)] space-y-2">
            <div className="text-xs text-slate-400 font-semibold">RECENT ACTIVITY</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-white">User123 went live</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 bg-purple-400 rounded-full" />
                <span className="text-white">New achievement unlocked</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 bg-cyan-400 rounded-full" />
                <span className="text-white">+500 Troll Coins earned</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gradient Overlay for Depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-purple-900/20 pointer-events-none" />

      <style>
        {`
          @keyframes grid-flow {
            0% { transform: translateY(0); }
            100% { transform: translateY(50px); }
          }
          
          @keyframes pulse-slow {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.1); }
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-12px); }
          }
          
          @keyframes float-slow {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          
          .animate-pulse-slow {
            animation: pulse-slow 4s ease-in-out infinite;
          }
          
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
          
          .animate-float-slow {
            animation: float-slow 6s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
}
