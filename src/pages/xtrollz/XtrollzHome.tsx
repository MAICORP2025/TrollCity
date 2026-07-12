import { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import XTROLLZHeader from '@/components/xtrollz/XTROLLZHeader'
import LiveStreamGrid from '@/components/xtrollz/LiveStreamGrid'
import XTROLLZFooter from '@/components/xtrollz/XTROLLZFooter'
import GoLiveModal from '@/components/xtrollz/GoLiveModal'
import FavoritesTab from '@/components/xtrollz/FavoritesTab'
import ViewerSubscriptionModal from '@/components/xtrollz/ViewerSubscriptionModal'
import type { XTrollzStream, ViewerTab, XTrollzFavorite } from '@/lib/xtrollz'
import { XTROLLZ_CATEGORIES } from '@/lib/xtrollz'
import { Loader2, Lock, Radio } from 'lucide-react'

type DobGateState =
  | 'loading'
  | 'not_authenticated'
  | 'missing_application'
  | 'pending_application'
  | 'application_denied'
  | 'dob_required'
  | 'underage'
  | 'dob_mismatch'
  | 'rules_acceptance_required'
  | 'restricted'
  | 'approved'

export default function XtrollzHome() {
  const navigate = useNavigate()
  useLocation()
  const { user, profile } = useAuthStore()

  const [gateState, setGateState] = useState<DobGateState>('loading')
  const [dob, setDob] = useState('')
  const [dobSubmitting, setDobSubmitting] = useState(false)
  const [streams, setStreams] = useState<XTrollzStream[]>([])
  const [tab, setTab] = useState<ViewerTab>('live_now')
  const [favorites, setFavorites] = useState<XTrollzFavorite[]>([])
  const [showGoLive, setShowGoLive] = useState(false)
  const [showMessageBubble, setShowMessageBubble] = useState(false)
  const [recentMessage, setRecentMessage] = useState<any>(null)
  const [subscriptionTarget, setSubscriptionTarget] = useState<{ streamerId: string; streamerName: string; profileImageUrl?: string } | null>(null)
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isApprovedBroadcaster = (profile as any)?.xtrollz_broadcaster_status === 'approved'

  const runGate = useCallback(async () => {
    if (!user?.id) {
      setGateState('not_authenticated')
      return
    }
    try {
      const { data, error } = await supabase.rpc('xtrollz_dob_gate_get_status', { p_user_id: user.id })
      if (error) throw error
      const status = (data?.result || data?.status || '').toString() as DobGateState
      setGateState(status || 'dob_required')
    } catch {
      setGateState('dob_required')
    }
  }, [user?.id])

  useEffect(() => {
    void runGate()
  }, [runGate])

  useEffect(() => {
    if (gateState !== 'approved' || !user?.id) return
    const fetchStreams = async () => {
      const { data, error } = await supabase.rpc('xtrollz_get_live_streams')
      if (!error && data) setStreams(data as XTrollzStream[])
    }
    void fetchStreams()

    const channel = supabase
      .channel('xtrollz-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'xtrollz_streams' }, () => {
        void fetchStreams()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [gateState, user?.id])

  useEffect(() => {
    if (gateState !== 'approved' || !user?.id) return
    const fetchFavorites = async () => {
      const { data } = await supabase.rpc('xtrollz_get_favorites', { p_user_id: user.id })
      if (data) setFavorites(data as XTrollzFavorite[])
    }
    void fetchFavorites()
  }, [gateState, user?.id])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`mobile-utromail-bubble:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_messages',
        },
        async (payload) => {
          const newMsg = payload.new as any
          if (!newMsg) return
          const { data: fullMsg } = await supabase
            .from('utromail_messages')
            .select('recipient_id, sender_id')
            .eq('id', newMsg.id)
            .maybeSingle()
          if (!fullMsg || fullMsg.recipient_id !== user.id) return
          if (fullMsg.sender_id === user.id) return
          const { data: sender } = await supabase
            .from('user_profiles')
            .select('username, avatar_url')
            .eq('id', newMsg.sender_id)
            .maybeSingle()
          if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
          setRecentMessage({
            id: newMsg.id,
            sender_id: newMsg.sender_id,
            sender_username: sender?.username || 'Unknown',
            sender_avatar_url: sender?.avatar_url || null,
            content: newMsg.body,
            conversation_id: newMsg.thread_id,
            created_at: newMsg.sent_at,
          })
          setShowMessageBubble(true)
          messageTimeoutRef.current = setTimeout(() => {
            setShowMessageBubble(false)
          }, 8000)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current)
    }
  }, [user?.id])

  const handleStreamClick = useCallback(
    (streamId: string) => {
      navigate(`/xtrollz/live/${streamId}`, { replace: false })
    },
    [navigate],
  )

  const handleOpenSubscription = useCallback((streamerId: string, streamerName: string) => {
    setSubscriptionTarget({ streamerId, streamerName })
  }, [])

  const handleOpenMessages = useCallback(() => {
    setShowMessageBubble(false)
    navigate('/utromail')
  }, [navigate])

  const handleTabChange = useCallback((newTab: ViewerTab) => {
    setTab(newTab)
  }, [])

  if (gateState === 'not_authenticated') {
    navigate('/auth', { replace: true })
    return null
  }

  if (gateState !== 'approved') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
        <div className="mx-auto max-w-6xl p-4">
          <div className="flex items-center gap-3 py-4">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10 shadow-[0_0_16px_rgba(168,85,247,0.25)]">
                <Radio size={18} className="text-purple-300" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">XTrollz</h1>
                <p className="text-xs text-white/60">Age-Restricted Secure Streaming</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 md:p-6">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-500/10">
                  {gateState === 'loading' ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
                </div>
                <div>
                  <p className="text-sm font-black">Access Gate</p>
                  <p className="text-xs text-white/60">
                    {gateState === 'loading' || gateState === 'dob_required'
                      ? 'Verify your date of birth to continue.'
                      : gateState === 'dob_mismatch' || gateState === 'underage'
                        ? 'The information entered could not be verified for XTrollz access.'
                        : 'Access denied by XTrollz security.'}
                  </p>
                </div>
              </div>

              {(gateState === 'dob_required' || gateState === 'dob_mismatch' || gateState === 'underage') && (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/60">Date of Birth</span>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      max="2005-01-01"
                      disabled={gateState === 'underage'}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/30 disabled:opacity-50"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={dobSubmitting || !dob}
                    onClick={async () => {
                      setDobSubmitting(true)
                      try {
                        const enteredDobIso = new Date(dob).toISOString()
                        const { data, error } = await supabase.rpc('xtrollz_verify_dob', {
                          p_user_id: user!.id,
                          p_entered_dob: enteredDobIso,
                        })
                        if (error) throw error
                        const result = (data?.result || '').toString() as DobGateState
                        setGateState(result === 'approved' ? 'approved' : result || 'dob_mismatch')
                      } catch {
                        setGateState('dob_mismatch')
                      } finally {
                        setDobSubmitting(false)
                      }
                    }}
                    className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-black text-white hover:bg-purple-500 disabled:opacity-50"
                  >
                    {dobSubmitting ? 'Verifying...' : 'Verify for XTrollz'}
                  </button>
                  {(gateState === 'dob_mismatch' || gateState === 'underage') && (
                    <p className="text-xs text-white/60">
                      The information entered could not be verified for XTrollz access.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 space-y-2">
                <p className="text-sm font-bold">XTrollz Access Restricted</p>
                <p className="text-xs text-white/60">
                  {gateState === 'missing_application'
                    ? 'You need an XTrollz application first.'
                    : gateState === 'pending_application'
                      ? 'Your XTrollz application is pending.'
                      : gateState === 'application_denied'
                        ? 'Your XTrollz application was denied.'
                        : gateState === 'rules_acceptance_required'
                          ? 'You must accept the current XTrollz Rules & Guidelines.'
                          : 'Your XTrollz access is currently restricted.'}
                </p>
                <button
                  onClick={() => navigate('/xtrollz/apply', { replace: false })}
                  className="rounded-xl bg-purple-600 px-4 py-3 text-sm font-black text-white hover:bg-purple-500"
                >
                  XTrollz Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
      <XTROLLZHeader
        tab={tab}
        onTabChange={handleTabChange}
        onOpenGoLive={() => setShowGoLive(true)}
        onOpenMessages={handleOpenMessages}
        profileImageUrl={profile?.avatar_url}
        displayName={profile?.display_name || user?.email}
        isApprovedBroadcaster={isApprovedBroadcaster}
      />

      <main className="mx-auto max-w-7xl px-4 py-4">
        {tab === 'live_now' && (
          <div>
            <h2 className="text-sm font-black text-white mb-3 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Live Now
            </h2>
            <LiveStreamGrid streams={streams} tab={tab} onStreamClick={handleStreamClick} onOpenSubscription={handleOpenSubscription} />
          </div>
        )}

        {tab === 'favorites' && <FavoritesTab favorites={favorites} onStreamClick={handleStreamClick} />}

        {tab === 'categories' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {XTROLLZ_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  const catStreams = streams.filter((s) => s.category === cat)
                  if (catStreams.length === 0) {
                    toast.error(`No ${cat} streams are currently live`)
                    return
                  }
                  setTab('live_now')
                }}
                className="rounded-2xl border border-white/10 bg-black/20 p-6 text-center hover:border-purple-400/30 hover:bg-black/30 transition-all"
              >
                <p className="text-lg font-black text-white">{cat}</p>
                <p className="mt-1 text-xs text-white/60">
                  {streams.filter((s) => s.category === cat).length} live
                </p>
              </button>
            ))}
          </div>
        )}
      </main>

      {showMessageBubble && recentMessage && (
        <div
          onClick={() => {
            setShowMessageBubble(false)
            navigate(`/utromail?user=${recentMessage.sender_id}`)
          }}
          className="fixed left-4 right-4 top-20 z-[80] cursor-pointer rounded-2xl border border-purple-500/30 bg-[#1A1A2E] p-4 shadow-2xl md:left-auto md:w-80"
        >
          <div className="flex items-start gap-3">
            <div className="relative shrink-0 h-12 w-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xs font-black text-white">
                {recentMessage.sender_username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#1A1A2E] bg-green-500 z-10" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h4 className="truncate text-sm font-bold text-white">{recentMessage.sender_username}</h4>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowMessageBubble(false) }}
                  className="-mr-1 -mt-1 rounded-full p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-gray-300">{recentMessage.content}</p>
              <p className="mt-2 text-xs text-gray-500">Tap to reply</p>
            </div>
          </div>
        </div>
      )}

      <XTROLLZFooter />

      {showGoLive && <GoLiveModal onClose={() => setShowGoLive(false)} />}

      {subscriptionTarget && (
        <ViewerSubscriptionModal
          streamerId={subscriptionTarget.streamerId}
          streamerName={subscriptionTarget.streamerName}
          profileImageUrl={subscriptionTarget.profileImageUrl}
          onClose={() => setSubscriptionTarget(null)}
          onSubscribed={() => {
            setSubscriptionTarget(null)
            toast.success('Subscription active!')
          }}
        />
      )}
    </div>
  )
}
