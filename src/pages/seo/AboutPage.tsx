import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, SEOContentSection, CTASection } from './SEOLayout'
import { Eye, Radio, Users, Building2, Sparkles, Play, TrendingUp, DollarSign, Smartphone, Globe, MessageCircle, Gift, Shield, Zap, Star, ArrowRight, Twitch, Instagram, Youtube } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const features = [
  {
    icon: Radio,
    title: 'Live Broadcasting',
    description: 'Stream to unlimited viewers with real-time interaction, virtual gifts, and monetization tools. Go viral on FYP with engaging content.',
    slug: '/broadcasting'
  },
  {
    icon: Building2,
    title: 'Government System',
    description: 'Participate in Troll City democracy. Vote for leaders, run for office, and shape the future of our virtual nation.',
    slug: '/government'
  },
  {
    icon: Sparkles,
    title: 'Content Categories',
    description: 'Discover trending content across gaming, music, chat, art, and more. Find your community and go viral.',
    slug: '/categories'
  },
  {
    icon: DollarSign,
    title: 'Creator Economy',
    description: 'Earn money from home as a content creator. Monetize your streams, get tips, and join our partner program.',
    slug: '/creators'
  },
  {
    icon: MessageCircle,
    title: 'Social Communities',
    description: 'Join families, create groups, and connect with like-minded people. Build your tribe and dominate together.',
    slug: '/explore'
  },
  {
    icon: Gift,
    title: 'Virtual Economy',
    description: 'Buy, sell, and trade in our marketplace. Own property, collect items, and build your virtual empire.',
    slug: '/marketplace'
  },
]

const trendingSearches = [
  { term: 'go live app', category: 'Streaming' },
  { term: 'make money streaming', category: 'Creator' },
  { term: 'best streaming platform', category: 'Platform' },
  { term: 'live chat app', category: 'Social' },
  { term: 'content creator tips', category: 'Creator' },
  { term: 'viral streaming', category: 'Trending' },
  { term: 'work from home jobs', category: 'Creator' },
  { term: 'social media monetization', category: 'Creator' },
  { term: 'live broadcasting software', category: 'Tech' },
  { term: 'best streaming apps 2026', category: 'Trending' },
]

interface PlatformStats {
  monthlyUsers: number;
  activeCreators: number;
  dailyStreams: number;
  creatorEarnings: number;
}

function StatsSection() {
  const [stats, setStats] = useState<PlatformStats>({
    monthlyUsers: 0,
    activeCreators: 0,
    dailyStreams: 0,
    creatorEarnings: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchStats = async () => {
      try {
        // Get total users count
        const { count: userCount } = await supabase
          .from('user_profiles')
          .select('*', { count: 'exact', head: true })

        // Get active creators (unique users who broadcasted in last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: creatorData } = await supabase
          .from('streams')
          .select('broadcaster_id')
          .gte('created_at', thirtyDaysAgo)
        
        const uniqueCreators = new Set(creatorData?.map(s => s.broadcaster_id).filter(Boolean))
        const creatorCount = uniqueCreators.size

        // Get daily live streams count
        const { count: dailyStreamCount } = await supabase
          .from('streams')
          .select('*', { count: 'exact', head: true })
          .eq('is_live', true)

        // Get creator earnings from creator_earnings view
        const { data: earningsData } = await supabase
          .from('creator_earnings')
          .select('total_earnings_usd')
          .limit(100)
        
        const totalEarnings = earningsData?.reduce((sum, row) => sum + (row.total_earnings_usd || 0), 0) || 0

        if (mounted) {
          setStats({
            monthlyUsers: userCount || 0,
            activeCreators: creatorCount || 0,
            dailyStreams: dailyStreamCount || 0,
            creatorEarnings: totalEarnings,
          })
          setLoading(false)
        }
      } catch (error) {
        console.error('Error fetching platform stats:', error)
        if (mounted) setLoading(false)
      }
    }

    fetchStats()

    // Poll every 60 seconds
    const interval = setInterval(fetchStats, 60000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M+'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K+'
    return num.toString()
  }

  const formatCurrency = (num: number): string => {
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M+'
    if (num >= 1000) return '$' + (num / 1000).toFixed(1) + 'K+'
    return '$' + num.toString()
  }

  const statItems = [
    { value: loading ? '...' : formatNumber(stats.monthlyUsers), label: 'Monthly Users' },
    { value: loading ? '...' : formatNumber(stats.activeCreators), label: 'Active Creators' },
    { value: loading ? '...' : formatNumber(stats.dailyStreams), label: 'Daily Streams' },
    { value: loading ? '...' : formatCurrency(stats.creatorEarnings), label: 'Creator Earnings' },
  ]

  return (
    <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
      {statItems.map((stat, index) => (
        <div key={index} className="text-center">
          <div className="text-3xl md:text-4xl font-bold text-white mb-1">{stat.value}</div>
          <div className="text-slate-400 text-sm">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

const howItWorks = [
  {
    step: '1',
    title: 'Create Your Account',
    description: 'Sign up free and customize your profile. Choose your username and avatar to start your journey in Troll City.'
  },
  {
    step: '2',
    title: 'Discover Content',
    description: 'Explore live streams, trending creators, and viral content. Swipe through broadcasts and find your favorites.'
  },
  {
    step: '3',
    title: 'Go Live & Create',
    description: 'Start broadcasting to the world. Engage with viewers, receive gifts, and build your audience organically.'
  },
  {
    step: '4',
    title: 'Earn & Grow',
    description: 'Monetize your content through gifts, tips, and our creator program. Turn your passion into income.'
  },
]

export default function AboutPage() {
  return (
    <SEOLayout
      title="About Troll City | Social Streaming Platform"
      description="Learn about Troll City (Mai Troll City) — a social streaming platform for creators, streamers, gamers, and online communities. Livestream, create communities, chat, and engage with content creators."
      keywords={[
        'Troll City', 'Mai Troll City', 'about Troll City', 'social streaming platform',
        'live streaming', 'go live', 'broadcasting', 'content creator', 'make money online',
        'work from home', 'viral app', 'FYP', 'TikTok alternative', 'live chat',
        'streaming platform', 'best streaming app', 'live broadcast', 'watch live streams',
        'creator economy', 'monetize content', 'social streaming', 'trending', 'live entertainment',
        'Troll City streaming', 'Troll City social platform', 'creator platform', 'community platform'
      ]}
    >
      <Breadcrumb items={[{ label: 'Home' }, { label: 'About' }]} />

      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(147,51,234,0.15),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
              <TrendingUp className="w-4 h-4" />
              Trending Worldwide - Join the Revolution
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Troll City
              </span>
              {' '}(Mai Troll City)
            </h1>
            
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Known throughout our community as <strong>Troll City</strong>, Mai Troll City is a social streaming platform 
              built for creators, streamers, gamers, and online communities. Troll City provides livestreaming, 
              community engagement tools, creator monetization features, and social interaction in one platform.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/auth"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Start Watching Free
              </Link>
              <Link
                to="/live"
                className="w-full sm:w-auto px-8 py-4 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Radio className="w-5 h-5" />
                Go Live Now
              </Link>
            </div>
          </div>

          <StatsSection />
          
          {/* App Store Badges */}
          <div className="max-w-7xl mx-auto mt-12">
            <p className="text-center text-sm text-slate-400 mb-4">Download Troll City</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {/* iOS - Coming Soon */}
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50 opacity-60">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <div className="text-left">
                  <p className="text-[10px] text-slate-400">Coming Soon</p>
                  <p className="text-sm font-semibold text-white">iOS App Store</p>
                </div>
              </div>
              
              {/* Google Play - Available */}
              <a 
                href="https://play.google.com/store/apps/details?id=com.trollcity.twa" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-green-500/50 hover:bg-slate-800 transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/>
                </svg>
                <div className="text-left">
                  <p className="text-[10px] text-green-400">Available</p>
                  <p className="text-sm font-semibold text-white">Google Play</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Trending Searches</h2>
            <p className="text-slate-400">Discover what people are looking for</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {trendingSearches.map((search, index) => (
              <Link
                key={index}
                to={`/explore?q=${encodeURIComponent(search.term)}`}
                className="px-4 py-2 bg-slate-800 hover:bg-purple-600/20 border border-slate-700 hover:border-purple-500/30 rounded-full text-slate-300 hover:text-purple-300 text-sm transition-colors"
              >
                {search.term}
                <span className="ml-2 text-xs text-slate-500">• {search.category}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Everything You Need in One Platform
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              From live broadcasting to social communities, Troll City has it all. 
              Discover why millions choose us as their go-to streaming destination.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Link
                  key={index}
                  to={feature.slug}
                  className="group p-6 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-2xl transition-all hover:bg-slate-800/50"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 flex items-center justify-center mb-4 group-hover:bg-purple-600/30 transition-colors">
                    <Icon className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                  <div className="mt-4 flex items-center text-purple-400 text-sm font-medium group-hover:text-purple-300">
                    Learn more <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Brand Identity & Clarification Section */}
      <section className="py-20 bg-gradient-to-b from-slate-900/50 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              What Is Troll City?
            </h2>
            <div className="space-y-6 text-slate-300 text-lg leading-relaxed">
              <p>
                <strong className="text-white">Troll City</strong> and <strong className="text-white">Mai Troll City</strong> are the same platform. 
                Known throughout our community as <strong className="text-white">Troll City</strong>, Mai Troll City is a social streaming and 
                content-sharing platform built for creators, streamers, gamers, and online communities.
              </p>
              <p>
                Troll City provides livestreaming, community engagement tools, creator monetization features, and social interaction 
                in one platform. Users can livestream, create communities, chat, and engage with content creators from around the world.
              </p>
              <p>
                <strong className="text-white">Troll City is a social streaming platform.</strong> It is not related to any physical city, 
                municipality, or geographic location. Troll City exists as a digital platform for online entertainment, creator content, 
                and community building.
              </p>
              <p>
                Whether you call it <strong className="text-white">Troll City</strong> or <strong className="text-white">Mai Troll City</strong>, 
                you're referring to the same social streaming platform that empowers creators, entertains viewers, and connects communities worldwide.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SEOContentSection
        title="How Troll City Works"
        description="Getting started is easy. Whether you want to watch or broadcast, we've made the process simple and intuitive."
        icon={Zap}
      >
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {howItWorks.map((item, index) => (
            <div key={index} className="relative">
              <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {item.step}
              </div>
              <div className="pt-8 pl-2">
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </SEOContentSection>

      <SEOContentSection
        title="Why Choose Troll City?"
        description="We're more than just a streaming platform. We're a community where creators thrive and viewers are entertained."
        icon={Star}
      >
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Shield className="w-3 h-3 text-green-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Safe & Secure</h4>
                <p className="text-slate-400 text-sm">Advanced moderation and community guidelines keep Troll City safe for everyone.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <DollarSign className="w-3 h-3 text-purple-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Fair Creator Earnings</h4>
                <p className="text-slate-400 text-sm">Keep more of what you earn. Our transparent payout system ensures creators get paid fairly.</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Globe className="w-3 h-3 text-pink-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Global Community</h4>
                <p className="text-slate-400 text-sm">Connect with streamers and viewers from around the world. Language is no barrier.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Smartphone className="w-3 h-3 text-blue-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Cross-Platform</h4>
                <p className="text-slate-400 text-sm">Watch and stream on any device. Desktop, mobile, or tablet – your content follows you.</p>
              </div>
            </div>
          </div>
        </div>
      </SEOContentSection>

      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Available On All Platforms</h2>
            <p className="text-slate-400">Access Troll City from anywhere</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-800 rounded-xl">
              <Smartphone className="w-6 h-6 text-purple-400" />
              <span className="text-white font-medium">iOS & Android</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-800 rounded-xl">
              <Globe className="w-6 h-6 text-purple-400" />
              <span className="text-white font-medium">Web Browser</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-800 rounded-xl">
              <Zap className="w-6 h-6 text-purple-400" />
              <span className="text-white font-medium">PWA Install</span>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title="Ready to Join the Community?"
        description="Start watching live streams, or become a creator today. It's free to join and easy to start."
        primaryAction={{ label: 'Create Free Account', path: '/auth' }}
        secondaryAction={{ label: 'Explore Live Streams', path: '/explore' }}
      />
    </SEOLayout>
  )
}
