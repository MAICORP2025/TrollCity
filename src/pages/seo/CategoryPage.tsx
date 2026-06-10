import React, { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import SEOLayout, { Breadcrumb, CTASection } from './SEOLayout'
import { Sparkles, Gamepad2, Music, Palette, MessageCircle, Utensils, Dumbbell, Code, Camera, Heart, ArrowRight, Play, Users, TrendingUp, Radio } from 'lucide-react'
import wheelpageImage from '../../assets/wheelpage.png'

type CategoryAction = {
  label: string
  path: string
}

type CategoryConfig = {
  name: string
  description: string
  longDescription: string
  keywords: string[]
  color: string
  changefreq: string
  ogDescription: string
  heroActions?: {
    primary?: CategoryAction
    secondary?: CategoryAction
  }
  footerActions?: {
    primary?: CategoryAction
    secondary?: CategoryAction
  }
}

const iconMap: Record<string, React.ElementType> = {
  gaming: Gamepad2,
  'just-chatting': MessageCircle,
  music: Music,
  art: Palette,
  food: Utensils,
  sports: Dumbbell,
  education: Code,
  entertainment: Camera,
  politics: Users,
  news: Radio,
}

const categoryData: Record<string, CategoryConfig> = {
  gaming: {
    name: 'Gaming',
    description: 'Watch live gaming streams on Troll City. Esports, video games, gaming commentary, and competitive tournaments.',
    longDescription: 'Discover the best live gaming streams on Troll City. From esports tournaments to casual gameplay, find your favorite gamers and join the action. Watch live gaming content, interact with streamers, and be part of the Troll City gaming community.',
    keywords: ['gaming streams', 'video game streaming', 'esports live', 'gamer streaming', 'Troll City gaming', 'live gaming', 'gaming platform'],
    color: 'from-green-600 to-emerald-600',
    changefreq: 'daily',
    ogDescription: 'Watch live gaming streams on Troll City. Esports, video games, gaming commentary, and competitive tournaments.',
  },
  'just-chatting': {
    name: 'Just Chatting',
    description: 'Discover UtroMail, community conversations, and live chat culture on Troll City.',
    longDescription: 'Just Chatting on Troll City is where conversations, community hangouts, and UtroMail messaging come together. This category explains how users connect with each other, join public chat rooms, and participate in social events without the pressure to stream.',
    keywords: ['UtroMail', 'live chat', 'community messaging', 'public discussion', 'Troll City chat', 'social conversation', 'chat platform'],
    color: 'from-purple-600 to-pink-600',
    changefreq: 'daily',
    ogDescription: 'Discover UtroMail, community conversations, and live chat culture on Troll City.',
    heroActions: {},
    footerActions: {},
  },
  music: {
    name: 'Music',
    description: 'Watch live music performances on Troll City. DJ sets, music creation, live concerts, and musical talent.',
    longDescription: 'Experience live music on Troll City. From DJ sets and live concerts to music creation sessions and acoustic performances, discover talented musicians streaming live. Troll City is the platform for music lovers and creators to connect through live streaming.',
    keywords: ['live music', 'music streaming', 'DJ stream', 'live performance', 'music app', 'Troll City music', 'live concert'],
    color: 'from-pink-600 to-rose-600',
    changefreq: 'daily',
    ogDescription: 'Watch live music performances on Troll City. DJ sets, music creation, live concerts, and musical talent.',
  },
  art: {
    name: 'Art & Creativity',
    description: 'Watch live art streams on Troll City. Digital art, painting, crafts, creative projects, and artistic tutorials.',
    longDescription: 'Explore creativity on Troll City. Watch live art streams featuring digital art, painting, crafts, creative projects, and artistic tutorials. Troll City is home to a vibrant community of artists who share their creative process through live streaming.',
    keywords: ['art stream', 'digital art', 'painting live', 'creative stream', 'art app', 'Troll City art', 'live drawing'],
    color: 'from-violet-600 to-purple-600',
    changefreq: 'daily',
    ogDescription: 'Watch live art streams on Troll City. Digital art, painting, crafts, creative projects, and artistic tutorials.',
  },
  food: {
    name: 'Food & Cooking',
    description: 'Watch live cooking streams on Troll City. Cooking shows, food reviews, recipe tutorials, and culinary content.',
    longDescription: 'Satisfy your appetite on Troll City. Watch live cooking streams featuring cooking shows, food reviews, recipe tutorials, and culinary content. From professional chefs to home cooks, discover food creators sharing their passion through live streaming.',
    keywords: ['cooking stream', 'food show', 'live cooking', 'recipe stream', 'foodie', 'Troll City cooking', 'food streaming'],
    color: 'from-orange-600 to-amber-600',
    changefreq: 'daily',
    ogDescription: 'Watch live cooking streams on Troll City. Cooking shows, food reviews, recipe tutorials, and culinary content.',
  },
  sports: {
    name: 'Sports',
    description: 'Watch live sports streams on Troll City. Sports commentary, workouts, athletic training, and fitness content.',
    longDescription: 'Get in the game on Troll City. Watch live sports streams featuring sports commentary, workouts, athletic training, and fitness content. Troll City is where sports enthusiasts and fitness creators come together through live streaming.',
    keywords: ['sports stream', 'workout live', 'fitness stream', 'sports commentary', 'training', 'Troll City sports', 'fitness streaming'],
    color: 'from-blue-600 to-cyan-600',
    changefreq: 'daily',
    ogDescription: 'Watch live sports streams on Troll City. Sports commentary, workouts, athletic training, and fitness content.',
  },
  politics: {
    name: 'Politics & Government',
    description: 'Learn how Troll City government works. Community bills, voter debates, platform policy, and civic participation.',
    longDescription: 'Explore Troll City politics. This category explains how community governance works, how elections are run, and how citizens vote on bills, campaigns, and platform policy. Politics in Troll City is about public debate, civic participation, and the in-platform government system that shapes the community.',
    keywords: ['Troll City politics', 'community government', 'voting', 'civic engagement', 'platform government', 'public debate', 'politics page'],
    color: 'from-indigo-600 to-blue-600',
    changefreq: 'daily',
    ogDescription: 'Learn how Troll City government works through public debate, elections, and civic participation.',
    heroActions: {},
    footerActions: {},
  },
  news: {
    name: 'News & TCNN',
    description: 'Browse TCNN public news articles, updates, and platform reports for the Troll City community.',
    longDescription: 'Stay informed with TCNN (Troll City News Network). This category highlights public news articles, breaking updates, and community reports produced by TCNN. Discover the latest platform announcements, event coverage, and civic news without the need to stream.',
    keywords: ['Troll City news', 'TCNN', 'public news', 'news articles', 'community updates', 'news coverage', 'platform reports'],
    color: 'from-red-600 to-orange-600',
    changefreq: 'hourly',
    ogDescription: 'Browse TCNN public news articles, updates, and platform reports for the Troll City community.',
    heroActions: {
      primary: { label: 'Browse TCNN Coverage', path: '/tcnn' },
    },
    footerActions: {
      primary: { label: 'Browse TCNN Coverage', path: '/tcnn' },
    },
  },
  entertainment: {
    name: 'Fun & Troll Wheel',
    description: 'Learn about Troll Wheel and Trollmonds. Spin for rewards, abilities, and live community experiences.',
    longDescription: 'Dive into Troll City fun. This category explains the Troll Wheel game, how Trollmonds work, and the special abilities users can win. Fun on Troll City is about community games, prizes, and unique interactive mechanics that make the platform more playful.',
    keywords: ['Troll Wheel', 'Trollmonds', 'fun category', 'community games', 'platform rewards', 'interactive activities', 'Troll City fun'],
    color: 'from-rose-600 to-pink-600',
    changefreq: 'daily',
    ogDescription: 'Learn about Troll Wheel, Trollmonds, and the fun rewards available in Troll City.',
    heroActions: {},
    footerActions: {},
  },
  education: {
    name: 'Learn & Academy',
    description: 'Explore Troll City Academy courses and online learning. Tutorials, skills, and knowledge-based content for users and creators.',
    longDescription: 'Build skills with Troll City Academy. This category explains the online courses, instructor-led classes, and learning paths available to users. Troll City Academy supports education, training, and skill sharing through classes, workshops, and public learning content.',
    keywords: ['Troll City Academy', 'online courses', 'learning platform', 'education', 'skill training', 'courses', 'online learning'],
    color: 'from-slate-600 to-zinc-600',
    changefreq: 'daily',
    ogDescription: 'Explore Troll City Academy courses, online learning, and skill-building content.',
    heroActions: {},
    footerActions: {},
  },
}

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const category = slug ? categoryData[slug] : null

  if (!category || !slug) {
    return (
      <SEOLayout
        title="Category Not Found | Troll City"
        description="Browse live streaming categories on Troll City."
      >
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">Category Not Found</h1>
            <p className="text-slate-400 mb-8">The category you're looking for doesn't exist.</p>
            <Link to="/categories" className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-500 transition-colors">
              Browse All Categories
            </Link>
          </div>
        </div>
      </SEOLayout>
    )
  }

  const Icon = iconMap[slug] || Sparkles

  // JSON-LD structured data for category page
  useEffect(() => {
    const existingSchema = document.querySelector('#category-schema')
    if (existingSchema) existingSchema.remove()

    const schemaScript = document.createElement('script')
    schemaScript.id = 'category-schema'
    schemaScript.type = 'application/ld+json'
    schemaScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      'name': `${category.name} Streams on Troll City`,
      'description': category.longDescription,
      'url': `https://maitrollcity.com/categories/${slug}`,
      'isPartOf': {
        '@type': 'WebSite',
        'name': 'Troll City',
        'url': 'https://maitrollcity.com'
      },
      'about': {
        '@type': 'Thing',
        'name': category.name,
        'description': category.description
      },
      'mainEntity': {
        '@type': 'ItemList',
        'name': `Live ${category.name} Streams`,
        'description': `Discover live ${category.name.toLowerCase()} streams on Troll City`
      }
    })
    document.head.appendChild(schemaScript)

    return () => {
      const schema = document.querySelector('#category-schema')
      if (schema) schema.remove()
    }
  }, [slug, category.name, category.description, category.longDescription])

  return (
    <SEOLayout
      title={`${category.name} Streams on Troll City | Social Streaming Platform`}
      description={category.ogDescription}
      keywords={category.keywords}
    >
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Categories', path: '/categories' }, { label: category.name }]} />

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-900 to-pink-900/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(147,51,234,0.15),transparent_50%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${category.color} bg-opacity-20 border border-white/10 text-white text-sm font-medium mb-6`}>
              <Icon className="w-4 h-4" />
              {category.heroActions === undefined ? `Live ${category.name} Streams` : category.name}
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              {category.name} on{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Troll City
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              {category.longDescription}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {((category.heroActions && category.heroActions.primary) || !category.heroActions) ? (
                <Link
                  to={(category.heroActions && category.heroActions.primary) ? category.heroActions.primary.path : '/explore'}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  {(category.heroActions && category.heroActions.primary) ? category.heroActions.primary.label : 'Watch Live Now'}
                </Link>
              ) : null}

              {((category.heroActions && category.heroActions.secondary) || !category.heroActions) ? (
                <Link
                  to={(category.heroActions && category.heroActions.secondary) ? category.heroActions.secondary.path : '/go-live'}
                  className="w-full sm:w-auto px-8 py-4 border border-slate-600 text-white font-semibold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Radio className="w-5 h-5" />
                  {(category.heroActions && category.heroActions.secondary) ? category.heroActions.secondary.label : 'Start Streaming'}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* About This Category */}
      <section className="py-16 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6">
              About {category.name} on Troll City
            </h2>
            <div className="space-y-4 text-slate-300 text-lg leading-relaxed">
              <p>
                {category.longDescription}
              </p>
              <p>
                Troll City is a social platform where community, discovery, and shared experiences come together. Whether you are exploring content, news, games, or education, Troll City gives you the tools to learn, play, and stay informed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {slug === 'news' && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-6">TCNN News for Everyone</h2>
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4 text-slate-300 text-lg leading-relaxed">
                <p>
                  The News & TCNN page is your public source for Troll City updates, announcements, and civic reporting. TCNN publishes articles for the whole community so anyone can read about platform events, elections, policy changes, and featured stories.
                </p>
                <p>
                  TCNN coverage is designed for public access, which means you can discover news without needing to stream. Browse headlines, read written reports, and keep up with the latest developments across Troll City.
                </p>
                <ul className="list-disc list-inside space-y-2 text-slate-300">
                  <li>Public news articles and TCNN reports</li>
                  <li>Updates on community events and platform announcements</li>
                  <li>Easy access to elections, government decisions, and civic stories</li>
                </ul>
              </div>
              <div className="rounded-3xl overflow-hidden border border-slate-800 shadow-lg shadow-black/30">
                <img src="/img/tcnn_page.png" alt="TCNN Coverage" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </section>
      )}

      {slug === 'just-chatting' && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-6">UtroMail & Community Chat</h2>
            <div className="space-y-4 text-slate-300 text-lg leading-relaxed">
              <p>
                Just Chatting on Troll City is more than a streaming category—it is where users connect through UtroMail, community conversations, and real-time discussion. UtroMail is the in-app chat and messaging system that powers social interaction across the platform.
              </p>
              <p>
                Use UtroMail to send messages, share links, join community rooms, and participate in events. This category is ideal for connecting with friends, discovering trending conversations, and exploring what the Troll City social layer has to offer.
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-300">
                <li>Read about UtroMail and how it keeps the community connected</li>
                <li>Discover chat rooms, public discussions, and social events</li>
                <li>Learn how Troll City balances conversation, moderation, and community fun</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {slug === 'politics' && (
        <section className="py-16 bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-6">Troll City Government Explained</h2>
            <div className="space-y-4 text-slate-300 text-lg leading-relaxed">
              <p>
                Politics on Troll City is about community governance, elections, and the platform’s public decision-making process. This page explains how voters, campaigns, and bills work inside the Troll City society.
              </p>
              <p>
                Troll City politics lets users participate in democracy through polls, elections, and debates. Citizens can influence platform policies, support public representatives, and follow government updates without needing to stream.
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-300">
                <li>How Troll City elections and voting work</li>
                <li>What community bills and public policy mean</li>
                <li>Where to find civic updates and structured government news</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {slug === 'entertainment' && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-6">Troll Wheel, Trollmonds, and Live Rewards</h2>
            <div className="grid gap-10 lg:grid-cols-2 items-center">
              <div className="space-y-4 text-slate-300 text-lg leading-relaxed">
                <p>
                  The Fun category is where Troll City games and rewards come together. Spin the Troll Wheel to earn Trollmonds, unlock special broadcast abilities, and take part in the platform’s playful economy.
                </p>
                <p>
                  Trollmonds are the reward currency you use across Troll City. Players can win Trollmonds from the wheel and spend them on abilities, gifts, or event perks. Each spin has a chance to award valuable boosts or rare effects.
                </p>
                <ul className="list-disc list-inside space-y-2 text-slate-300">
                  <li>Win Trollmonds from the Troll Wheel to power up your experience</li>
                  <li>Unlock abilities like ghost mode, featured broadcaster, or free perks</li>
                  <li>Use Trollmonds for gifts, in-game advantages, and community rewards</li>
                </ul>
              </div>
              <div className="rounded-3xl overflow-hidden border border-slate-800 shadow-lg shadow-black/40">
                <img src={wheelpageImage} alt="Troll Wheel page" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </section>
      )}

      {slug === 'education' && (
        <section className="py-16 bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-white mb-6">Troll City Academy & Online Courses</h2>
            <div className="space-y-4 text-slate-300 text-lg leading-relaxed">
              <p>
                The Learn category showcases Troll City Academy and its online courses. We offer tutorials, skill-building classes, and education content for creators, users, and anyone who wants to level up in the platform.
              </p>
              <p>
                Academy content includes programming courses, creative workshops, business skills, and community training. Troll City supports structured learning so users can grow through courses, guided lessons, and knowledge-sharing streams.
              </p>
              <ul className="list-disc list-inside space-y-2 text-slate-300">
                <li>Online courses for creative skills, business, and community leadership</li>
                <li>Instructor-led classes and tutorials from Troll City experts</li>
                <li>Study paths that help users learn new tools, earn badges, and improve their channel</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Other Categories */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Explore Other Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Object.entries(categoryData)
              .filter(([key]) => key !== slug)
              .map(([key, cat]) => {
                const CatIcon = iconMap[key] || Sparkles
                return (
                  <Link
                    key={key}
                    to={`/categories/${key}`}
                    className="group p-4 bg-slate-900/50 border border-slate-800 hover:border-purple-500/30 rounded-xl transition-all text-center"
                  >
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${cat.color} flex items-center justify-center mx-auto mb-3`}>
                      <CatIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white text-sm font-medium">{cat.name}</span>
                  </Link>
                )
              })}
          </div>
        </div>
      </section>

      {(() => {
        const footerPrimary = category.footerActions?.primary ?? (category.footerActions === undefined ? { label: 'Explore Live Streams', path: '/explore' } : undefined)
        const footerSecondary = category.footerActions?.secondary ?? (category.footerActions === undefined ? { label: 'Start Streaming', path: '/go-live' } : undefined)
        const showFooter = Boolean(footerPrimary || footerSecondary)

        if (!showFooter) return null

        return (
          <CTASection
            title={footerSecondary ? `Ready to Watch ${category.name} Live?` : `Explore ${category.name} on Troll City`}
            description={footerSecondary ? `Join Troll City and discover the best live ${category.name.toLowerCase()} streams from creators worldwide.` : `Browse ${category.name} content, updates, and coverage for Troll City.`}
            primaryAction={footerPrimary}
            secondaryAction={footerSecondary}
          />
        )
      })()}
    </SEOLayout>
  )
}
