import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Send, Shield, Coins } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import { Room, RoomEvent } from 'livekit-client'
import XTROLLZHeader from '@/components/xtrollz/XTROLLZHeader'
import XTROLLZFooter from '@/components/xtrollz/XTROLLZFooter'

export default function XTrollzLiveViewer() {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<{ allowed: boolean; reason: string } | null>(null)
  const [stream, setStream] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [gifting, setGifting] = useState(false)
  const [giftAmount, setGiftAmount] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const roomRef = useRef<Room | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!streamId) return
    setLoading(true)
    let cancelled = false

    ;(async () => {
      const { data } = await supabase.rpc('xtrollz_check_viewer_access', {
        p_stream_id: streamId,
        p_user_id: user?.id,
      })
      if (cancelled) return
      if (!data?.allowed) {
        setAccess({ allowed: false, reason: data?.reason || 'unknown' })
        setLoading(false)
        return
      }
      setAccess({ allowed: true, reason: 'ok' })

      const { data: streamData } = await supabase
        .from('xtrollz_streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle()
      if (!cancelled && streamData) setStream(streamData)

      if (!cancelled) setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [streamId, user?.id])

  const connectToStream = useCallback(async () => {
    if (!streamId || !stream?.livekit_room_name) return
    try {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
          room: stream.livekit_room_name,
          userId: user?.id,
          identity: user?.id || 'viewer',
          mode: 'xtrollz-viewer',
        },
      })
      if (error || !data?.token) throw new Error(error?.message || 'No token')

      const room = new Room({ adaptiveStream: true, dynacast: true })
      roomRef.current = room

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === 'video' && videoRef.current) {
          videoRef.current.srcObject = new MediaStream([track.mediaStreamTrack])
          videoRef.current.play().catch(() => {})
        }
      })

      await room.connect(data.url, data.token)
      setIsConnected(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to connect to stream')
      console.error(e)
    }
  }, [streamId, stream?.livekit_room_name, user?.id])

  useEffect(() => {
    if (access?.allowed && !isConnected) {
      void connectToStream()
    }
    return () => {
      roomRef.current?.disconnect()
      roomRef.current = null
    }
  }, [access?.allowed, isConnected, connectToStream])

  const handleSendChat = async () => {
    if (!chatInput.trim() || !user?.id || !streamId) return
    const { error } = await supabase.from('xtrollz_stream_messages').insert({
      stream_id: streamId,
      user_id: user.id,
      body: chatInput.trim(),
      sender_name: profile?.display_name || user.email,
    })
    if (error) {
      toast.error('Failed to send message')
      return
    }
    setChatMessages((prev) => [...prev, { body: chatInput.trim(), sender_name: profile?.display_name || 'You', is_me: true }])
    setChatInput('')
  }

  const handleGift = async () => {
    if (!giftAmount || !user?.id || !streamId) return
    const amount = parseInt(giftAmount, 10)
    if (!amount || amount <= 0) return
    setGifting(true)
    try {
      const { error } = await supabase.rpc('send_gift', {
        p_stream_id: streamId,
        p_sender_id: user.id,
        p_amount: amount,
      })
      if (error) {
        toast.error(error.message || 'Failed to send gift')
        return
      }
      toast.success(`Gifted ${amount} Troll Coins!`)
      setChatMessages((prev) => [...prev, { body: `Gifted ${amount} Troll Coins!`, sender_name: 'You', is_gift: true }])
      setGiftAmount(null)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send gift')
    } finally {
      setGifting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0814] text-white">
        <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">Loading...</div>
      </div>
    )
  }

  if (!access?.allowed) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
        <XTROLLZHeader tab="live_now" onTabChange={() => navigate('/xtrollz')} onOpenGoLive={() => {}} onOpenMessages={() => {}} />
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-md rounded-3xl border border-white/10 bg-black/20 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 mx-auto">
              <Shield size={28} className="text-red-400" />
            </div>
            <h2 className="mt-4 text-lg font-black text-white">Access Denied</h2>
            <p className="mt-2 text-xs text-white/60">
              {access?.reason === 'account_suspended_or_banned'
                ? 'Your account is suspended or banned.'
                : access?.reason === 'not_verified'
                  ? 'You must be age and identity verified to view XTrollz streams.'
                  : access?.reason === 'stream_not_found'
                    ? 'This stream no longer exists.'
                    : access?.reason === 'stream_not_active'
                      ? 'This stream is no longer live.'
                      : access?.reason === 'blocked'
                        ? 'You cannot view this stream.'
                        : 'You do not have permission to view this stream.'}
            </p>
            <button
              onClick={() => navigate('/xtrollz')}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-black text-white hover:bg-purple-500"
            >
              <ArrowLeft size={16} /> Back to XTrollz
            </button>
          </div>
        </main>
        <XTROLLZFooter />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
      <XTROLLZHeader tab="live_now" onTabChange={() => navigate('/xtrollz')} onOpenGoLive={() => {}} onOpenMessages={() => {}} />

      <main className="mx-auto flex max-w-7xl flex-1 flex-col gap-4 px-4 py-4 lg:flex-row">
        <div className="flex-1">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video ref={videoRef} autoPlay muted controls className="h-full w-full object-cover" />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <button
                  onClick={connectToStream}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-black text-white hover:bg-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.4)]"
                >
                  Join Stream
                </button>
              </div>
            )}
            <div className="absolute left-3 top-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white shadow-[0_0_8px_rgba(220,38,38,0.5)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black text-white">{stream?.title || 'XTrollz Stream'}</h1>
              <p className="text-xs text-white/60">{stream?.category || 'Chat'}</p>
            </div>
            <div className="flex items-center gap-2">
               <button
                 onClick={() => {}}
                 className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10"
               >
                <Heart size={14} /> Favorite
              </button>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col rounded-2xl border border-white/10 bg-black/20 lg:w-80">
          <div className="border-b border-white/10 p-3">
            <h3 className="text-xs font-black text-white">Stream Chat</h3>
          </div>
          <div className="flex-1 min-h-[200px] max-h-[400px] overflow-y-auto p-3 space-y-2">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`text-xs ${msg.is_me ? 'text-right' : 'text-left'}`}>
                <span className="font-bold text-purple-300">{msg.sender_name}:</span>{' '}
                <span className={msg.is_gift ? 'text-amber-300 font-black' : 'text-gray-300'}>{msg.body}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-white/10 p-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Send a message..."
                className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
              />
              <button onClick={handleSendChat} className="rounded-xl bg-purple-600 px-3 py-2 text-white hover:bg-purple-500">
                <Send size={14} />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={giftAmount || ''}
                onChange={(e) => setGiftAmount(e.target.value)}
                placeholder="Coins"
                className="w-20 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
              />
              <button
                onClick={handleGift}
                disabled={gifting}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
              >
                <Coins size={14} /> {gifting ? 'Sending...' : 'Gift'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <XTROLLZFooter />
    </div>
  )
}
