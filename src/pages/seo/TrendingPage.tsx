import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SEOLayout, { Breadcrumb, CTASection } from './SEOLayout'
import { Flame, TrendingUp, Play, Users, Eye, ArrowRight, Radio, Zap, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface TrendingStream {
  id: string
  title: string
  broadcaster_id: string
  broadcaster_username: string
  broadcaster_avatar: string | null
  viewer_count: number
  is_live: boolean
  category: string | null
  started_at: string
}

interface TrendingCreator {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  followers_count: number
  is_live: boolean
}

export default function TrendingPage() {
  const [streams, setStreams] = useState<TrendingStream[]>([])
  const [newCreators, setNewCreators] = useState<TrendingCreator[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const fetchTrending = async () => {
      try {
        // Get trending live streams by viewer count
        const { data: liveStreams } = await supabase
          .from('streams')
          .select('id, title, broadcaster_id, current_viewers, is_live, category, started_at, created_at')
          .eq('is_live', true)
          .order('current_viewers', { ascending: false })
          .limit(20)

        const broadcasterIds = [...new Set((liveStreams || []).map((s: any) => s.broadcaster_id).filter(Boolean))]
        let broadcasterMap = new Map<string, any>()

        if (broadcasterIds.length > 0) {
          const { data: broadcasters } = await supabase
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', broadcasterIds)
          if (broadcasters) {
            broadcasterMap = new Map(broadcasters.map((b: any) => [b.id, b]))
          }
        }

        // Get new/rising creators (recent followers growth)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: recentFollows } = await supabase
          .from('user_follows')
          .select('following_id')
          .gte('created_at', sevenDaysAgo)

        const followCountMap = new Map<string, number>()
        ;(recentFollows || []).forEach((f: any) => {
          followCountMap.set(f.following_id, (followCountMap.get(f.following_id) || 0) + 1)
        })

        // Get profiles for top followed creators
        const topCreatorIds = [...followCountMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([id]) => id)

        let newCreatorProfiles: TrendingCreator[] = []
        if (topCreatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', topCreatorIds)

          const { data: liveStatus } = await supabase
            .from('streams')
            .select('broadcaster_id')
            .eq('is_live', true)
            .in('broadcaster_id', topCreatorIds)

          const liveSet = new Set((liveStatus || []).map((s: any) => s.broadcaster_id))

          newCreatorProfiles = (profiles || []).map((p: any) => ({
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            followers_count: followCountMap.get(p.id) || 0,
            is_live: liveSet.has(p.id),
          })).sort((a, b) => b.followers_count - a.followers_count)
        }

        if (mounted) {
          setStreams((liveStreams || []).map((s: any) => {
            const b = broadcasterMap.get(s.broadcaster_id)
            return {
              id: s.id,
              title: s.title || 'Untitled Stream',
              broadcaster_id: s.broadcaster_id,
              broadcaster_username: b?.username || 'Unknown',
              broadcaster_avatar: b?.avatar_url || null,
              viewer_count: s.current_viewers || 0,
              is_live: s.is_live,
              category: s.category,
              started_at: s.started_at || s.created_at,
            }
          }))
          setNewCreators(newCreatorProfiles)
          setLoading(false)
        }
      } catch (err) {
        console.error('Error fetching trending:', err)
        if (mounted) setLoading(false)
      }
    }

    fetchTrending()
    const interval = setInterval(fetchTrending, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  return (
    <SEOLayout
      title="Trending on Troll City | Hot Streams, Rising Creators & Live Now"
      description="See what's trending on Troll City right now. Watch the hottest live streams, discover rising creators, and find the most popular content on our social streaming platform."
      keywords={[
        'Troll City trending', 'trending streams', 'hot streams', 'live now',
        'rising creators', 'popular streams', 'Troll City live', 'what\'s trending',
        'social streaming', 'live streaming platform'
      ]}
    >
      <Breadcrumb items={[{ label: 'Home', path: '/' }, { label: 'Trending' }]} />

      {/* Hero */}
      <section className="relative py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-slate-900 to-orange-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/20 border border-red-500/30 text-red-300 text-sm font-medium mb-6">
            <Flame className="w-4 h-4" />
            Trending Now
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            What's Hot on{' '}
            <span className="bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
              Troll City
            </span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            The most-watched live streams, fastest-rising creators, and trending content — updated in real time.
          </p>
        </div>
      </section>

      {/* Trending Streams */}
      <section className="pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-red-400" />
              Trending Streams
            </h2>
            <Link to="/live-swipe" className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1">
              All Live <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {streams.slice(0, 12).map((stream, index) => (
                <Link
                  key={stream.id}
                  to={`/watch/${stream.id}`}
                  className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-red-500/30 transition-all"
                >
                  <div className="aspect-video bg-slate-800 flex items-center justify-center relative">
                    {stream.broadcaster_avatar ? (
                      <img src={stream.broadcaster_avatar} alt={stream.broadcaster_username} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
                    ) : (
                      <Play className="w-12 h-12 text-slate-600" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {/* Rank badge */}
                    {index < 3 && (
                      <div className={`absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm ${
                        index === 0 ? 'bg-amber-500 text-black' :
                        index === 1 ? 'bg-slate-400 text-black' :
                        'bg-orange-600 text-white'
                      }`}>
                        {index + 1}
                      </div>
                    )}

                    {/* Live badge */}
                    {stream.is_live && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded text-white text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LIVE
                      </div>
                    )}

                    {/* Viewer count */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded text-white text-xs font-medium">
                      <Eye className="w-3 h-3" />
                      {stream.viewer_count.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900/80">
                    <p className="text-white text-sm font-bold truncate">{stream.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-slate-400 text-xs">@{stream.broadcaster_username}</span>
                      {stream.category && (
                        <span className="text-purple-400 text-xs">{stream.category}</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Rising Creators */}
      {newCreators.length > 0 && (
        <section className="py-12 bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Zap className="w-6 h-6 text-yellow-400" />
                  Rising Creators
                </h2>
                <p className="text-slate-400 text-sm mt-1">Fastest-growing creators this week</p>
              </div>
              <Link to="/top-creators" className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1">
                Full Leaderboard <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {newCreators.slice(0, 10).map((creator) => (
                <Link
                  key={creator.id}
                  to={`/profile/${encodeURIComponent(creator.username)}`}
                  className="group flex flex-col items-center gap-2 p-4 bg-slate-800/50 border border-slate-700 hover:border-purple-500/30 rounded-xl transition-all text-center"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                      {creator.avatar_url ? (
                        <img src={creator.avatar_url} alt={creator.username} className="w-full h-full object-cover" />
                      ) : (
                        (creator.display_name || creator.username || '?')[0].toUpperCase()
                      )}
                    </div>
                    {creator.is_live && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-800" />
                    )}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold truncate">{creator.display_name || creator.username}</p>
                    <p className="text-slate-400 text-xs">+{creator.followers_count} followers</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CTASection
        title="Want to Trend on Troll City?"
        description="Go live, create engaging content, and build your audience. The next trending creator could be you."
        primaryAction={{ label: 'Go Live Now', path: '/go-live' }}
        secondaryAction={{ label: 'Explore Trending', path: '/live-swipe' }}
      />
    </SEOLayout>
  )
}
