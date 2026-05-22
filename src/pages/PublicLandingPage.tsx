import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import {
  BadgeDollarSign,
  BookOpen,
  Radio as Broadcast,
  Building2,
  CalendarDays,
  Church,
  Coins,
  Crown,
  Gavel,
  Gift,
  GraduationCap,
  Landmark,
  Radio,
  Shield,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react'

interface StepCardProps {
  number: string
  title: string
  description: string
  icon: React.ReactNode
  accent?: 'cyan' | 'purple' | 'pink' | 'gold'
}

interface FeatureCardProps {
  title: string
  description: string
  icon: React.ReactNode
  accent?: 'cyan' | 'purple' | 'pink' | 'gold' | 'teal'
}

function accentClasses(accent: StepCardProps['accent'] = 'cyan') {
  const map = {
    cyan: {
      border: 'border-cyan-400/40',
      glow: 'shadow-[0_0_28px_rgba(34,211,238,0.18)]',
      text: 'text-cyan-300',
      bg: 'from-cyan-500/15 to-blue-500/5',
    },
    purple: {
      border: 'border-purple-400/40',
      glow: 'shadow-[0_0_28px_rgba(168,85,247,0.18)]',
      text: 'text-purple-300',
      bg: 'from-purple-500/15 to-fuchsia-500/5',
    },
    pink: {
      border: 'border-pink-400/40',
      glow: 'shadow-[0_0_28px_rgba(236,72,153,0.18)]',
      text: 'text-pink-300',
      bg: 'from-pink-500/15 to-purple-500/5',
    },
    gold: {
      border: 'border-yellow-400/40',
      glow: 'shadow-[0_0_28px_rgba(234,179,8,0.18)]',
      text: 'text-yellow-300',
      bg: 'from-yellow-500/15 to-orange-500/5',
    },
    teal: {
      border: 'border-teal-400/40',
      glow: 'shadow-[0_0_28px_rgba(45,212,191,0.18)]',
      text: 'text-teal-300',
      bg: 'from-teal-500/15 to-cyan-500/5',
    },
  }

  return map[accent]
}

function StepCard({ number, title, description, icon, accent = 'cyan' }: StepCardProps) {
  const a = accentClasses(accent)

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${a.border} bg-gradient-to-br ${a.bg} p-5 ${a.glow}`}
    >
      <div className="absolute right-4 top-3 text-2xl font-black text-white/10">{number}</div>
      <div className={`${a.text} mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/35`}>
        {icon}
      </div>
      <h3 className={`text-lg font-black uppercase tracking-wide ${a.text}`}>{title}</h3>
      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">{description}</p>
    </div>
  )
}

function FeatureCard({ title, description, icon, accent = 'cyan' }: FeatureCardProps) {
  const a = accentClasses(accent)

  return (
    <div
      className={`relative min-h-[170px] overflow-hidden rounded-2xl border ${a.border} bg-gradient-to-br ${a.bg} p-5 text-center ${a.glow}`}
    >
      <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black/35 ${a.text}`}>
        {icon}
      </div>
      <h3 className={`text-lg font-black uppercase tracking-wide ${a.text}`}>{title}</h3>
      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">{description}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-8 flex items-center gap-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-400/60 to-purple-400/50" />
      <h2 className="text-center text-xl font-black uppercase tracking-[0.28em] text-white drop-shadow-[0_0_14px_rgba(34,211,238,0.75)] md:text-2xl">
        {children}
      </h2>
      <div className="h-px flex-1 bg-gradient-to-r from-purple-400/50 via-cyan-400/60 to-transparent" />
    </div>
  )
}

export default function PublicLandingPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Track if we've already navigated to prevent multiple redirects
  const hasNavigatedRef = useRef(false)

  useEffect(() => {
    if (user && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true
      navigate('/home', { replace: true })
    }
  }, [user, navigate])

  // Show loading state while redirecting (prevents flash)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#02040b] text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading Troll City...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#02040b] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(217,70,239,0.18),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0),rgba(2,6,23,0.92))]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(34,211,238,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,.18)_1px,transparent_1px)] [background-size:44px_44px]" />

      <main className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/25 bg-black/35 p-6 shadow-[0_0_50px_rgba(34,211,238,0.16)] backdrop-blur-xl md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(34,211,238,0.22),transparent_28%),radial-gradient(circle_at_85%_55%,rgba(217,70,239,0.22),transparent_30%)]" />

          <div className="relative grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                <Radio className="h-4 w-4" />
                The Virtual Broadcasting City
              </div>

              <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tight md:text-7xl">
                <span className="block bg-gradient-to-r from-cyan-200 via-white to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,211,238,0.55)]">
                  Troll City
                </span>
                <span className="mt-3 block bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                  Broadcasting City
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-slate-300">
                Go live. Build your community. Earn gifts. Explore a city-style social experience
                where entertainment, opportunity, and live interaction all connect.
              </p>
              
              {/* Get Started Button with glowing red/green effect */}
              <div className="mt-6">
                <button
                  onClick={() => navigate('/auth')}
                  className="relative px-10 py-4 rounded-2xl font-black text-lg uppercase tracking-wide text-white overflow-hidden group transition-all duration-300 hover:scale-105"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-red-600 via-pink-600 to-green-600" />
                  <span className="absolute inset-0 bg-gradient-to-r from-green-600 via-emerald-500 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="absolute inset-0 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.5)] group-hover:shadow-[0_0_40px_rgba(239,68,68,0.7),0_0_40px_rgba(34,197,94,0.7)] transition-shadow" />
                  <span className="absolute inset-0 rounded-2xl animate-pulse-glow" />
                  <span className="relative">Get Started Here</span>
                </button>
                <style>{`
                  @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.5), 0 0 30px rgba(34,197,94,0.4); }
                    50% { box-shadow: 0 0 30px rgba(239,68,68,0.8), 0 0 40px rgba(34,197,94,0.6); }
                  }
                  .animate-pulse-glow {
                    animation: pulse-glow 2s ease-in-out infinite;
                  }
                `}</style>
              </div>
            </div>

            <div className="relative min-h-[380px] overflow-hidden rounded-[2rem] border border-purple-400/25 bg-[#050816]/80 p-6 shadow-[0_0_45px_rgba(168,85,247,0.22)]">
              <div className="absolute inset-x-10 bottom-0 h-56 rounded-t-[4rem] border border-cyan-400/25 bg-gradient-to-t from-cyan-500/20 to-transparent blur-sm" />

              <div className="absolute left-1/2 top-8 h-72 w-24 -translate-x-1/2 rounded-t-full border border-cyan-400/40 bg-gradient-to-t from-cyan-500/25 via-purple-500/25 to-pink-500/30 shadow-[0_0_45px_rgba(34,211,238,0.4)]" />
              <div className="absolute left-1/2 top-20 flex h-28 w-28 -translate-x-1/2 items-center justify-center rounded-full border border-cyan-300/60 bg-black/70 shadow-[0_0_40px_rgba(34,211,238,0.55)]">
                <span className="text-5xl font-black text-cyan-200">T</span>
              </div>

              <div className="absolute left-8 top-12 rounded-2xl border border-cyan-400/35 bg-black/45 px-5 py-4 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
                <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Broadcast</p>
                <p className="mt-1 text-sm font-semibold text-white">Your Story</p>
              </div>

              <div className="absolute right-8 top-16 rounded-2xl border border-pink-400/35 bg-black/45 px-5 py-4 shadow-[0_0_24px_rgba(236,72,153,0.2)]">
                <p className="text-xs font-black uppercase tracking-widest text-pink-300">Earn</p>
                <p className="mt-1 text-sm font-semibold text-white">Gifts & Coins</p>
              </div>

              <div className="absolute bottom-14 left-10 rounded-2xl border border-purple-400/35 bg-black/45 px-5 py-4 shadow-[0_0_24px_rgba(168,85,247,0.2)]">
                <p className="text-xs font-black uppercase tracking-widest text-purple-300">Build</p>
                <p className="mt-1 text-sm font-semibold text-white">Community</p>
              </div>

              <div className="absolute bottom-14 right-10 rounded-2xl border border-cyan-400/35 bg-black/45 px-5 py-4 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
                <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Explore</p>
                <p className="mt-1 text-sm font-semibold text-white">The City</p>
              </div>

              <div className="absolute bottom-32 left-1/2 -translate-x-1/2 rounded-2xl border border-pink-400/50 bg-pink-500/15 px-8 py-4 text-center shadow-[0_0_35px_rgba(236,72,153,0.32)]">
                <p className="text-3xl font-black uppercase tracking-widest text-pink-200">Live</p>
              </div>
            </div>
          </div>
        </section>

        {/* PAYOUTS */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-pink-400/40 bg-gradient-to-r from-pink-500/15 to-black/40 p-6 shadow-[0_0_30px_rgba(236,72,153,0.18)]">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-400/35 bg-black/35 text-pink-300">
                <CalendarDays className="h-9 w-9" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase text-pink-300">Weekly Friday Payouts</h2>
                <p className="mt-1 text-base font-medium text-slate-300">
                  Cash out every Friday. Reliable payouts. Every week.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-400/40 bg-gradient-to-r from-cyan-500/15 to-black/40 p-6 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/35 bg-black/35 text-cyan-300">
                <Zap className="h-9 w-9" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase text-cyan-300">Manual Instant Payouts</h2>
                <p className="mt-1 text-base font-medium text-slate-300">
                  Need it sooner? Instant payouts are manually processed by our team.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW TO BROADCAST */}
        <SectionTitle>How To Broadcast</SectionTitle>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StepCard
            number="01"
            title="Create Your Account"
            description="Sign up in seconds and join the Troll City."
            icon={<Users className="h-8 w-8" />}
            accent="cyan"
          />
          <StepCard
            number="02"
            title="Go To Neighborhood"
            description="Head to Neighborhood to get your license before you go live."
            icon={<Building2 className="h-8 w-8" />}
            accent="purple"
          />
          <StepCard
            number="03"
            title="Go Live"
            description="Start your live broadcast and share your world with the city."
            icon={<Broadcast className="h-8 w-8" />}
            accent="cyan"
          />
          <StepCard
            number="04"
            title="Earn Gifts & Coins"
            description="Receive gifts from your audience and earn coins that grow your value."
            icon={<Gift className="h-8 w-8" />}
            accent="pink"
          />
        </section>

        {/* EXPERIENCES */}
        <SectionTitle>Explore Troll City Experiences</SectionTitle>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FeatureCard
            title="Elections"
            description="Run, vote, and lead the city."
            icon={<Landmark className="h-9 w-9" />}
            accent="cyan"
          />
          <FeatureCard
            title="Jail"
            description="Break the rules? Do your time."
            icon={<Shield className="h-9 w-9" />}
            accent="purple"
          />
          <FeatureCard
            title="Court"
            description="Justice is served. Make your case."
            icon={<Gavel className="h-9 w-9" />}
            accent="pink"
          />
          <FeatureCard
            title="Church"
            description="Spiritual talks, events, and faith community."
            icon={<Church className="h-9 w-9" />}
            accent="cyan"
          />
          <FeatureCard
            title="MAI Class"
            description="Learn, grow, and level up your knowledge."
            icon={<GraduationCap className="h-9 w-9" />}
            accent="purple"
          />
          <FeatureCard
            title="Troll Families"
            description="Create or join a family. Stronger together."
            icon={<Users className="h-9 w-9" />}
            accent="pink"
          />
        </section>

        {/* ECONOMY */}
        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl border border-yellow-400/40 bg-gradient-to-br from-yellow-500/15 via-black/60 to-orange-500/10 p-6 shadow-[0_0_35px_rgba(234,179,8,0.18)]">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-yellow-400/20 blur-3xl" />
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-yellow-400/35 bg-black/40 text-yellow-300">
                <Coins className="h-11 w-11" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.28em] text-yellow-300">Coin Economy</p>
                <h2 className="mt-2 text-4xl font-black text-cyan-100 drop-shadow-[0_0_16px_rgba(34,211,238,0.65)]">
                  100 Coins = $1
                </h2>
                <p className="mt-2 text-base font-medium text-slate-300">
                  Simple. Transparent. Valuable. Your time. Your content. Your earnings.
                </p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 via-black/60 to-purple-500/15 p-6 shadow-[0_0_35px_rgba(34,211,238,0.18)]">
            <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-400/50 bg-black/50 text-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.3)]">
                <Sparkles className="h-11 w-11" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">Hype Coins</p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  Watch live. Earn Hype. Convert to Troll Coins.
                </h2>
                <p className="mt-2 text-base font-medium text-slate-300">
                  Earn Hype Coins by watching live broadcasts, then convert them into Troll Coins.
                </p>
              </div>
              <div className="hidden text-yellow-300 md:block">
                <Crown className="h-14 w-14" />
              </div>
            </div>
          </div>
        </section>

        {/* WHY STAY */}
        <SectionTitle>Why Stay In Troll City?</SectionTitle>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FeatureCard
            title="Broadcasting"
            description="Share your talent and connect with a global audience."
            icon={<Radio className="h-8 w-8" />}
            accent="cyan"
          />
          <FeatureCard
            title="Community"
            description="Make friends, support each other, and grow together."
            icon={<Users className="h-8 w-8" />}
            accent="purple"
          />
          <FeatureCard
            title="Families"
            description="Join or build a family and create your legacy."
            icon={<Shield className="h-8 w-8" />}
            accent="pink"
          />
          <FeatureCard
            title="Learning"
            description="Access classes and content to level up your skills."
            icon={<BookOpen className="h-8 w-8" />}
            accent="cyan"
          />
          <FeatureCard
            title="City Systems"
            description="Elections, court, jail, church, and more. A city that is alive."
            icon={<Building2 className="h-8 w-8" />}
            accent="purple"
          />
          <FeatureCard
            title="Rewards"
            description="Earn gifts, coins, and real value for your efforts."
            icon={<BadgeDollarSign className="h-8 w-8" />}
            accent="pink"
          />
        </section>

        {/* FOOTER */}
        <footer className="mt-10 overflow-hidden rounded-[2rem] border border-cyan-400/25 bg-black/45 p-6 shadow-[0_0_38px_rgba(34,211,238,0.13)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/45 bg-cyan-500/10 text-3xl font-black text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.3)]">
                T
              </div>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-wide text-cyan-100">Troll City</h2>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Broadcast. Connect. Earn. Belong.
                </p>
              </div>
            </div>

            <div className="max-w-md text-left md:text-right">
              <p className="text-base font-semibold text-slate-300">
                Troll City is more than an app. It is a movement. It is a city.
              </p>
              <p className="mt-1 text-lg font-black text-cyan-300">It’s your future.</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}