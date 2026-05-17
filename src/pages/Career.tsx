import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store'
import {
  ArrowLeft,
  Briefcase,
  Search,
  Shield,
  Video,
  FileText,
  Star,
  Store,
  Newspaper,
  Radio,
  Mic,
  Cross,
  Users,
  Crown,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  Gavel,
  Headset,
  GraduationCap,
  Building2,
} from 'lucide-react'

interface JobPosition {
  id: string
  title: string
  department: string
  description: string
  requirements: string[]
  benefits: string[]
  icon: React.ElementType
  color: string
}

const jobPositions: JobPosition[] = [
  {
    id: 'lead_officer',
    title: 'Lead Troll Officer',
    department: 'Leadership',
    description:
      'Senior enforcement role overseeing Troll Officers, reviewing cases, escalating decisions, and keeping city rules consistent.',
    requirements: [
      'Previous Troll Officer experience',
      'Strong leadership and communication skills',
      'Ability to train and mentor new officers',
    ],
    benefits: [
      'Leadership role with higher responsibility',
      'Access to admin dashboard',
      'Platform-wide influence',
    ],
    icon: Crown,
    color: 'from-yellow-500 to-orange-500',
  },
  {
    id: 'troll_officer',
    title: 'Troll Officer',
    department: 'TCPS / Moderation',
    description:
      'Official city enforcer responsible for reports, moderation, investigations, arrests, and real-time safety response.',
    requirements: [
      'Previous moderation experience',
      'Strong understanding of community guidelines',
      'Good judgment under pressure',
    ],
    benefits: [
      'Officer badge',
      'Access to officer tools',
      'Community recognition',
    ],
    icon: Shield,
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'attorney',
    title: 'Troll Court Attorney',
    department: 'Troll Court',
    description:
      'Defense attorney representing defendants in Troll Court cases, appeals, hearings, and disputes.',
    requirements: [
      'Strong reasoning skills',
      'Excellent communication',
      'Professional courtroom conduct',
    ],
    benefits: [
      'Attorney badge',
      'Access to court case system',
      'Build reputation as advocate',
    ],
    icon: FileText,
    color: 'from-amber-500 to-yellow-500',
  },
  {
    id: 'prosecutor',
    title: 'Troll Court Prosecutor',
    department: 'Troll Court',
    description:
      'Represents Troll City in court cases, reviews evidence, presents charges, and supports city justice.',
    requirements: [
      'Understanding of court process',
      'Strong presentation skills',
      'Commitment to fair judgment',
    ],
    benefits: [
      'Prosecutor badge',
      'Access to case management',
      'City-wide recognition',
    ],
    icon: Gavel,
    color: 'from-red-500 to-orange-500',
  },
  {
    id: 'pastor',
    title: 'Pastor',
    department: 'Community / Spiritual',
    description:
      'Community leader role for hosting services, guidance, counseling, and positive city events.',
    requirements: [
      'Strong faith/community leadership',
      'Compassion and guidance skills',
      'Respect for all community members',
    ],
    benefits: [
      'Pastor role recognition',
      'Lead church-related content',
      'Special community channels',
    ],
    icon: Cross,
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'troller',
    title: 'Troller',
    department: 'Broadcasting',
    description:
      'Entertainer role focused on playful chaos, satire, comedy, and broadcast engagement within city rules.',
    requirements: [
      'Must be 18 years or older',
      'Ability to create engaging content',
      'Stable internet and basic streaming setup',
    ],
    benefits: [
      'Earn coins from engagement',
      'Broadcast growth opportunities',
      'Platform-wide promotion potential',
    ],
    icon: Video,
    color: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'seller',
    title: 'Seller',
    department: 'Commerce',
    description:
      'Verified merchant role authorized to sell goods, services, or digital items inside Troll City commerce.',
    requirements: [
      'Verified user',
      'Clear business/product plan',
      'Ability to fulfill orders responsibly',
    ],
    benefits: [
      'Seller badge',
      'Marketplace access',
      'Secure transaction flow',
    ],
    icon: Store,
    color: 'from-indigo-500 to-violet-500',
  },
  {
    id: 'journalist',
    title: 'Journalist',
    department: 'TCNN - News',
    description:
      'Write articles, conduct investigations, and keep the city informed through Troll City News Network.',
    requirements: [
      'Strong writing skills',
      'Ability to research and verify facts',
      'Commitment to unbiased reporting',
    ],
    benefits: [
      'Journalist badge',
      'Access to TCNN content dashboard',
      'Potential to advance to News Caster',
    ],
    icon: Newspaper,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'news_caster',
    title: 'News Caster',
    department: 'TCNN - Broadcasting',
    description:
      'On-air TCNN personality delivering breaking news, live reports, and official city broadcasts.',
    requirements: [
      'Broadcasting or journalism experience',
      'Professional on-camera presence',
      'Must be at least 18 years old',
    ],
    benefits: [
      'News Caster badge',
      'Ability to go live on TCNN',
      'Platform-wide visibility',
    ],
    icon: Mic,
    color: 'from-red-500 to-orange-500',
  },
  {
    id: 'chief_news_caster',
    title: 'Chief News Caster',
    department: 'TCNN - Leadership',
    description:
      'Lead the TCNN team, manage journalists/news casters, approve breaking news, and maintain editorial standards.',
    requirements: [
      'News/journalism leadership experience',
      'Strong editorial judgment',
      'Team management skills',
    ],
    benefits: [
      'Chief News Caster badge',
      'Manage TCNN staff',
      'Access to TCNN analytics dashboard',
    ],
    icon: Radio,
    color: 'from-amber-500 to-yellow-500',
  },
  {
    id: 'auctioneer',
    title: 'Auctioneer',
    department: 'Live Auctions',
    description:
      'Host live auction shows where users bid with Troll Coins and build a trusted auctioneer reputation.',
    requirements: [
      'Must be 18 years or older',
      'Good community standing',
      'Reliable streaming setup',
    ],
    benefits: [
      'Auctioneer Studio access',
      'Earn from successful auctions',
      'Moderate auction rooms',
    ],
    icon: Star,
    color: 'from-green-500 to-emerald-500',
  },
    {
      id: 'operations_runner',
      title: 'City Operations Runner',
      department: 'Operations',
      description:
        'Help test features, report bugs, prepare events, and support the daily operations of Troll City.',
      requirements: [
        'Attention to detail',
        'Ability to follow checklists',
        'Reliable communication',
      ],
      benefits: [
        'Operations experience',
        'Event support access',
        'Pathway into staff roles',
      ],
      icon: Building2,
      color: 'from-slate-400 to-cyan-500',
    },
    {
      id: 'troll_family',
      title: 'Troll Family Founder',
      department: 'Community / Family',
      description:
        'Create and lead a Troll Family, recruit members, participate in family wars, and build a legacy within the city.',
      requirements: [
        'Must be at least Level 10',
        'Have at least 1000 Troll Coins',
        'Strong leadership and recruitment skills',
      ],
      benefits: [
        'Family creation privileges',
        'Access to family management tools',
        'Ability to declare family wars',
      ],
      icon: Users,
      color: 'from-rose-500 to-pink-500',
    },
]

const departments = ['All', ...Array.from(new Set(jobPositions.map((job) => job.department)))]

export default function OpenPositions() {
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('All')

  const isAdminOrLead =
    profile?.role === 'admin' ||
    profile?.troll_role === 'admin' ||
    profile?.role === 'hr_admin' ||
    profile?.is_admin ||
    profile?.role === 'lead_troll_officer' ||
    profile?.troll_role === 'lead_troll_officer' ||
    profile?.is_lead_officer

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return jobPositions.filter((job) => {
      const matchesDepartment = department === 'All' || job.department === department
      const matchesSearch =
        !normalized ||
        job.title.toLowerCase().includes(normalized) ||
        job.department.toLowerCase().includes(normalized) ||
        job.description.toLowerCase().includes(normalized)

      return matchesDepartment && matchesSearch
    })
  }, [query, department])

  const handleApply = (position: JobPosition) => {
    if (!user) {
      toast.error('Please sign in to apply')
      navigate('/auth')
      return
    }

    if (position.id === 'hr_manager') {
      // HR manager application removed
      toast.error('This position is no longer available')
      return
    }

    // Career applications coming soon
    toast.info('Career applications are coming soon!')
    return
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,0,60,0.22),transparent_38%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,180,0,0.16),transparent_35%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(128,0,255,0.16),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-red-950/30 backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="absolute right-0 top-0 h-44 w-44 rounded-bl-[5rem] bg-red-500/10 blur-2xl" />
          <div className="absolute bottom-0 left-0 h-44 w-44 rounded-tr-[5rem] bg-yellow-400/10 blur-2xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-yellow-200">
                <Sparkles className="h-4 w-4" />
                Troll City Careers
              </div>

              <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Applications &{' '}
                <span className="bg-gradient-to-r from-red-300 via-yellow-200 to-orange-300 bg-clip-text text-transparent">
                  Careers
                </span>
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg">
                Apply for real Troll City roles across TCPS, Troll Court, TCNN, broadcasting,
                commerce, auctions, support, HR, operations, and MAI Class student pathways.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                <Briefcase className="mb-3 h-5 w-5 text-red-300" />
                <p className="text-2xl font-black">{jobPositions.length}</p>
                <p className="text-xs font-medium text-slate-300">Career paths</p>
              </div>

              <div className="rounded-2xl border border-yellow-400/20 bg-yellow-500/10 p-4">
                <Crown className="mb-3 h-5 w-5 text-yellow-300" />
                <p className="text-2xl font-black">City</p>
                <p className="text-xs font-medium text-slate-300">Staff pipeline</p>
              </div>

            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-black/50 p-4 shadow-xl shadow-black/30 backdrop-blur-xl">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search applications, careers, departments, or descriptions..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-red-400/60 focus:ring-2 focus:ring-red-400/20"
              />
            </label>

            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-yellow-400/60 focus:ring-2 focus:ring-yellow-400/20 lg:w-64"
            >
              {departments.map((item) => (
                <option key={item} value={item} className="bg-black">
                  {item}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((position) => {
            const Icon = position.icon

            return (
              <article
                key={position.id}
                className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] shadow-xl shadow-black/30 backdrop-blur-xl transition hover:-translate-y-1 hover:border-red-300/40 hover:bg-white/[0.06]"
              >
                <div className={`bg-gradient-to-r ${position.color} p-5`}>
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white/20 p-3">
                      <Icon className="h-6 w-6 text-white" />
                    </div>

                    <div>
                      <h2 className="text-xl font-black text-white">{position.title}</h2>
                      <p className="text-sm font-semibold text-white/75">{position.department}</p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <p className="min-h-24 text-sm leading-6 text-slate-300">
                    {position.description}
                  </p>

                  <div className="mt-5">
                    <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-red-200">
                      Requirements
                    </h3>

                    <ul className="space-y-2">
                      {position.requirements.map((requirement) => (
                        <li key={requirement} className="flex gap-2 text-sm text-slate-300">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-300" />
                          <span>{requirement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-5">
                    <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-yellow-200">
                      Benefits
                    </h3>

                    <ul className="space-y-2">
                      {position.benefits.map((benefit) => (
                        <li key={benefit} className="flex gap-2 text-sm text-slate-300">
                          <Star className="mt-0.5 h-4 w-4 shrink-0 text-yellow-300" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApply(position)}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${position.color} px-5 py-3 text-sm font-black text-white shadow-lg shadow-black/30 transition hover:scale-[1.02]`}
                  >
                    Apply Now
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      </main>
    </div>
  )
}
