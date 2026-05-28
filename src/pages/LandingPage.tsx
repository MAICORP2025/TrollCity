import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Users,
  Coins,
  Trophy,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

import { useAuthStore } from '../lib/store';
import MoneyRain from '../components/MoneyRain';
import { supabase } from '../lib/supabase';
import { trollCityTheme } from '../styles/trollCityTheme';
import HomeLiveGrid from '@/components/broadcast/HomeLiveGrid';
import LandingBg from '../assets/Landing.png';
import './LandingPage.css';

interface PlatformStats {
  totalUsers: number;
  totalPaidOut: number;
  liveStreamsCount: number;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuthStore();

  const [isEntering, setIsEntering] = useState(false);
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalPaidOut: 0,
    liveStreamsCount: 0,
  });

  // Keep event state disabled unless you re-enable seasonal events later
  const isActive = false;
  const primaryColor = '#a855f7';
  const secondaryColor = '#22d3ee';

  // Theme audio effect disabled
  useEffect(() => {
    // playTheme();
  }, []);

  // Fetch platform stats
  useEffect(() => {
    const loadStats = async () => {
      try {
        const { count: usersCount } = await supabase
          .from('user_profiles')
          .select('id', { count: 'exact' });

        const { count: streamsCount } = await supabase
          .from('streams')
          .select('id', { count: 'exact' })
          .eq('is_live', true);

        const { data: payoutData } = await supabase
          .from('payout_requests')
          .select('amount')
          .eq('status', 'completed');

        const totalPaidOut =
          payoutData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        setStats({
          totalUsers: usersCount || 0,
          totalPaidOut,
          liveStreamsCount: streamsCount || 0,
        });
      } catch (error) {
        console.error('Failed to load platform stats:', error);
      }
    };

    loadStats();

    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleEnterTrollCity = () => {
    setIsEntering(true);

    window.setTimeout(() => {
      if (user) {
        navigate('/home');
      } else {
        navigate('/auth');
      }
    }, 900);
  };

  const features = [
    {
      icon: Play,
      title: 'Go Live & Get Paid',
      description: 'Get Paid Every Friday',
    },
    {
      icon: Users,
      title: 'Build Your Squad',
      description: 'Connect with viewers and grow your community',
    },
    {
      icon: Coins,
      title: 'Earn Troll Coins',
      description: 'In-game currency for exclusive perks',
    },
    {
      icon: Trophy,
      title: 'Level Up & Compete',
      description: 'Gain XP, unlock rewards, and dominate',
    },
  ];

  return (
    <>
      {/* Loading overlay during auth init — prevents content flash */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0814]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-purple-500/30 border-t-purple-500" />
            <p className="text-slate-400">Loading Troll City...</p>
          </div>
        </div>
      )}

      <div className="relative min-h-screen w-full overflow-x-hidden font-sans bg-[#05030b]">
        {/* Landing page background image */}
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${LandingBg})`,
          }}
          aria-hidden="true"
        />

        {/* Dark readable overlay */}
        <div
          className="fixed inset-0 z-0 bg-gradient-to-b from-black/55 via-[#090617]/55 to-black/80"
          aria-hidden="true"
        />

        {/* Extra Troll City glow overlay */}
        <div
          className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.22),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_50%_90%,rgba(236,72,153,0.16),transparent_40%)]"
          aria-hidden="true"
        />

        {isActive && (
          <div
            className="pointer-events-none fixed inset-0 z-0"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}10 0%, ${secondaryColor}10 100%)`,
            }}
          />
        )}

        {/* Money Rain Effect */}
        {isEntering && <MoneyRain />}

        {/* Main Content */}
        <div className="relative z-10 flex min-h-screen flex-col">
          {/* Hero Section */}
          <div className="flex flex-1 items-center justify-center px-4 py-12 pt-24">
            <div className="w-full max-w-7xl">
              <div className="grid items-center gap-12 lg:grid-cols-2">
                {/* Left: Content */}
                <div className="animate-fade-in-up space-y-8 text-center lg:text-left">
                  {/* Logo/Title */}
                  <div className="space-y-4">
                    <div
                      className={`mb-4 inline-flex items-center gap-2 rounded-full px-4 py-2 ${
                        isActive
                          ? 'border-pink-500/20 bg-pink-500/10'
                          : 'border-purple-500/20 bg-purple-500/10'
                      }`}
                    >
                      <Sparkles
                        className={`h-4 w-4 ${
                          isActive ? 'text-pink-400' : 'text-purple-400'
                        }`}
                      />
                      <span
                        className={`text-sm font-semibold ${
                          isActive ? 'text-pink-400' : 'text-purple-400'
                        }`}
                      >
                        {isActive ? '🎉 Event Active!' : 'Get Paid Every Friday'}
                      </span>
                    </div>

                    <h1 className="text-5xl font-black sm:text-6xl md:text-7xl lg:text-8xl">
                      <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(168,85,247,0.35)]">
                        TROLL CITY
                      </span>
                    </h1>

                    <p className="text-xl font-bold text-slate-200 sm:text-2xl md:text-3xl">
                      Stream. Play. Earn. Dominate.
                    </p>

                    <p className="mx-auto max-w-xl text-base text-slate-300 sm:text-lg lg:mx-0">
                      The ultimate live streaming platform where creators get paid,
                      viewers earn rewards, and everyone levels up. Join the most fun
                      community in streaming.
                    </p>

                    {!user && (
                      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 backdrop-blur-md lg:mx-0">
                        New user launch promo starts May 1, 2026 at 3:00 PM MDT:
                        earn a 1,000 coin bonus on your first 7,500 coin cashout.
                      </div>
                    )}
                  </div>

                  {/* CTA Buttons */}
                  <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
                    <button
                      onClick={handleEnterTrollCity}
                      disabled={isEntering}
                      className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 px-8 py-4 text-lg font-bold text-white shadow-[0_10px_40px_rgba(147,51,234,0.4)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_15px_50px_rgba(236,72,153,0.5)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isEntering ? (
                        <>
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Entering...
                        </>
                      ) : (
                        <>
                          Enter Troll City
                          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>

                    {!user && (
                      <button
                        onClick={() => window.open('https://trollcity.app/install', '_blank')}
                        className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/30 bg-cyan-600/80 px-6 py-3 text-base font-bold text-white transition-colors duration-300 hover:bg-cyan-600"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm3.35-4.31c.34.27.59.69.59 1.19s-.22.9-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.27 1.31zM6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z" />
                        </svg>
                        Install App
                      </button>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="flex flex-wrap justify-center gap-6 pt-4 lg:justify-start">
                    <div className="text-center">
                      <div className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                        {stats.totalUsers > 0
                          ? stats.totalUsers >= 1000
                            ? `${(stats.totalUsers / 1000).toFixed(1)}k+`
                            : stats.totalUsers.toLocaleString()
                          : '10k+'}
                      </div>
                      <div className="text-sm text-slate-400">Active Users</div>
                    </div>

                    <div className="w-px bg-slate-700" />

                    <div className="text-center">
                      <div className="bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                        ${(stats.totalPaidOut / 1000).toFixed(0)}k+
                      </div>
                      <div className="text-sm text-slate-400">Paid Out</div>
                    </div>

                    <div className="w-px bg-slate-700" />

                    <div className="text-center">
                      <div className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
                        {stats.liveStreamsCount > 0 ? '24/7' : '24/7'}
                      </div>
                      <div className="text-sm text-slate-400">Live Streams</div>
                    </div>
                  </div>
                </div>

                {/* Right: Hero Visual - Hidden on mobile since background carries the page */}
                <div className="relative hidden animate-fade-in-right lg:block">
                  <div className="relative min-h-[400px] h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-purple-900/40 to-slate-900/80 shadow-[0_20px_70px_rgba(147,51,234,0.3)] backdrop-blur-md">
                    {/* Animated Background Grid */}
                    <div className="absolute inset-0 opacity-20">
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `
                            linear-gradient(rgba(147,51,234,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(147,51,234,0.3) 1px, transparent 1px)
                          `,
                          backgroundSize: '50px 50px',
                          animation: 'grid-flow 20s linear infinite',
                        }}
                      />
                    </div>

                    {/* Gradient Orbs */}
                    <div className="animate-pulse-slow absolute left-20 top-20 h-64 w-64 rounded-full bg-purple-600/30 blur-3xl" />
                    <div
                      className="animate-pulse-slow absolute bottom-20 right-20 h-80 w-80 rounded-full bg-pink-600/20 blur-3xl"
                      style={{ animationDelay: '1s' }}
                    />

                    {/* Main Content */}
                    <div className="relative z-10 flex h-full flex-col items-center justify-center p-8">
                      {/* Center Stage - Mock Streaming Interface */}
                      <div className="w-full max-w-2xl space-y-6">
                        {/* Top Bar - Live Indicator */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 rounded-full bg-red-600/90 px-4 py-2 shadow-[0_8px_24px_rgba(239,68,68,0.4)] backdrop-blur-sm">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-white" />
                            <span className="text-sm font-bold text-white">LIVE</span>
                            <span className="text-sm text-white/80">1.2K watching</span>
                          </div>

                          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                            <Users className="h-4 w-4 text-cyan-400" />
                            <span className="text-sm font-semibold text-white">10.5K</span>
                          </div>
                        </div>

                        {/* Main Video Area Mockup */}
                        <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/60 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                          {/* Simulated Video Content */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="group relative">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 opacity-50 blur-2xl transition-opacity group-hover:opacity-75" />
                              <div className="relative flex h-24 w-24 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 shadow-[0_20px_60px_rgba(147,51,234,0.6)] transition-transform group-hover:scale-110">
                                <Play className="ml-1 h-12 w-12 text-white" fill="white" />
                              </div>
                            </div>
                          </div>

                          {/* Floating Stats */}
                          <div className="animate-float absolute left-4 top-4">
                            <div className="rounded-xl border border-purple-400/30 bg-purple-600/90 px-4 py-2 backdrop-blur-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">+50 XP</span>
                              </div>
                            </div>
                          </div>

                          <div
                            className="animate-float absolute bottom-4 left-4"
                            style={{ animationDelay: '1s' }}
                          >
                            <div className="rounded-xl border border-pink-400/30 bg-pink-600/90 px-4 py-2 backdrop-blur-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">New Sub!</span>
                              </div>
                            </div>
                          </div>

                          {/* Bottom Chat Bar Mockup */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/95 to-transparent p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                                <span className="text-sm text-slate-400">
                                  Join the conversation...
                                </span>
                              </div>
                              <button className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2 text-sm font-semibold text-white">
                                Send
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Info Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full border-2 border-white/20 bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500" />
                            <div>
                              <div className="font-bold text-white">@YourUsername</div>
                              <div className="text-sm text-slate-400">Level 25 • 10K Trolls</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button className="rounded-full bg-gradient-to-r from-red-600 to-orange-600 px-6 py-2 font-bold text-white shadow-[0_8px_24px_rgba(239,68,68,0.4)] transition-all hover:scale-105 hover:shadow-[0_10px_30px_rgba(249,115,22,0.5)]">
                              Go Live
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Gradient Overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-purple-900/20" />
                  </div>

                  {/* Floating Badge */}
                  <div className="animate-float absolute -bottom-4 -right-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 shadow-[0_10px_40px_rgba(34,197,94,0.4)]">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-green-300" />
                      <span className="font-bold text-white">LIVE NOW</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Now Section */}
          <div className="px-4 py-8">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 text-center">
                <h2 className="mb-2 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
                  🔴 Live Now
                </h2>
                <p className="text-slate-400">Join the action in Troll City</p>
              </div>

              <HomeLiveGrid />
            </div>
          </div>

          {/* Features Section */}
          <div className="px-4 py-16">
            <div className="mx-auto max-w-7xl">
              <div className="mb-12 text-center">
                <h2 className="mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
                  Everything You Need
                </h2>
                <p className="text-xl text-slate-400">
                  A complete platform for creators and community members
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {features.map((feature, idx) => (
                  <div
                    key={idx}
                    className={`group ${trollCityTheme.components.card}`}
                    style={{
                      animation: 'fade-in-up 0.6s ease-out forwards',
                      animationDelay: `${idx * 0.1}s`,
                      opacity: 0,
                    }}
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-500 shadow-[0_8px_24px_rgba(147,51,234,0.3)] transition-shadow group-hover:shadow-[0_12px_32px_rgba(236,72,153,0.4)]">
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-white">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="py-8 text-center text-sm text-slate-500">
            © 2026 Troll City, LLC. All rights reserved.
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes fade-in-right {
            from { opacity: 0; transform: translateX(30px); }
            to { opacity: 1; transform: translateX(0); }
          }

          @keyframes float-particle {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
            10% { opacity: 0.5; }
            90% { opacity: 0.5; }
            50% { transform: translateY(-150px) translateX(30px); }
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }

          @keyframes grid-flow {
            0% { transform: translateY(0); }
            100% { transform: translateY(50px); }
          }

          @keyframes pulse-slow {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
          }

          .animate-fade-in-up {
            animation: fade-in-up 0.8s ease-out forwards;
          }

          .animate-fade-in-right {
            animation: fade-in-right 0.8s ease-out forwards;
            animation-delay: 0.3s;
            opacity: 0;
          }

          .animate-float {
            animation: float 3s ease-in-out infinite;
          }

          .animate-pulse-slow {
            animation: pulse-slow 4s ease-in-out infinite;
          }
        `}
      </style>
    </>
  );
}