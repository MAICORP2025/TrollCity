import React from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, SEOContentSection, CTASection } from './SEOLayout'
import { Eye, Radio, Users, Building2, Sparkles, Play, TrendingUp, DollarSign, MessageCircle, Gift, Shield, Zap, Star, ArrowRight, Globe, Smartphone } from 'lucide-react'

const features = [
  {
    icon: Radio,
    title: 'Live Broadcasting',
    description: 'Stream to unlimited viewers with real-time interaction, virtual gifts, and monetization tools.',
    slug: '/go-live'
  },
  {
    icon: Building2,
    title: 'Government System',
    description: 'Participate in Troll City democracy. Vote for leaders, run for office, and shape the future.',
    slug: '/government'
  },
  {
    icon: Sparkles,
    title: 'Content Categories',
    description: 'Discover trending content across gaming, music, art, and more.',
    slug: '/explore'
  },
  {
    icon: DollarSign,
    title: 'Creator Economy',
    description: 'Earn money as a content creator. Monetize streams, get tips, and join our partner program.',
    slug: '/creators'
  },
  {
    icon: MessageCircle,
    title: 'Social Communities',
    description: 'Join families, create groups, and connect with like-minded people.',
    slug: '/explore'
  },
  {
    icon: Gift,
    title: 'Virtual Economy',
    description: 'Buy, sell, and trade in our marketplace. Own property and build your virtual empire.',
    slug: '/marketplace'
  },
]

const howItWorks = [
  {
    step: '1',
    title: 'Create Your Account',
    description: 'Sign up free and customize your profile. Choose your username and avatar to start your journey.'
  },
  {
    step: '2',
    title: 'Discover Content',
    description: 'Explore live streams, trending creators, and viral content. Find your favorites.'
  },
  {
    step: '3',
    title: 'Go Live & Create',
    description: 'Start broadcasting to the world. Engage with viewers, receive gifts, and build your audience.'
  },
  {
    step: '4',
    title: 'Earn & Grow',
    description: 'Monetize your content through gifts, tips, and our creator program.'
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
        'work from home', 'viral app', 'live chat', 'streaming platform', 'best streaming app',
        'live broadcast', 'watch live streams', 'creator economy', 'monetize content',
        'social streaming', 'trending', 'live entertainment', 'Troll City streaming'
      ]}
    >
      <Breadcrumb items={[{ label: 'About' }]} />

      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(147,51,234,0.15),transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-sm font-medium mb-6">
              <TrendingUp className="w-4 h-4" />
              Trending Worldwide
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              About{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Troll City
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Troll City (Mai Troll City) is a social streaming platform built for creators, streamers, gamers, and online communities.
              We provide livestreaming, community engagement tools, creator monetization features, and social interaction in one platform.
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
                to="/auth"
                className="w-full sm:w-auto px-8 py-4 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
              >
                <Radio className="w-5 h-5" />
                Go Live Now
              </Link>
            </div>
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

      <section className="py-20 bg-gradient-to-b from-slate-900/50 to-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              What Is Troll City?
            </h2>
            <div className="space-y-6 text-slate-300 text-lg leading-relaxed">
              <p>
                <strong className="text-white">Troll City</strong> and <strong className="text-white">Mai Troll City</strong> are the same platform.
                Troll City is a social streaming and content-sharing platform built for creators, streamers, gamers, and online communities.
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
                <p className="text-slate-400 text-sm">Connect with streamers and viewers from around the world.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                <Smartphone className="w-3 h-3 text-blue-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Cross-Platform</h4>
                <p className="text-slate-400 text-sm">Watch and stream on any device. Desktop, mobile, or tablet.</p>
              </div>
            </div>
          </div>
        </div>
      </SEOContentSection>

      <CTASection
        title="Ready to Join the Community?"
        description="Start watching live streams, or become a creator today. It's free to join and easy to start."
        primaryAction={{ label: 'Create Free Account', path: '/auth' }}
        secondaryAction={{ label: 'Explore Live Streams', path: '/explore' }}
      />
    </SEOLayout>
  )
}
