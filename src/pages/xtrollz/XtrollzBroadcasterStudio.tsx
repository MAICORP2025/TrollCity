import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Radio, Mic, MicOff, Video, VideoOff, Send, Power } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/store'
import useLiveKitRoom from '@/hooks/useLiveKitRoom'

export default function XTrollzBroadcasterStudio() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [stream, setStream] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isLive, setIsLive] = useState(false)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState('')
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const { isConnected, error: lkError, joinAsPublisher, leaveRoom, localVideoTrack } = useLiveKitRoom({
    roomId: stream?.livekit_room_name || '',
    roomType: 'broadcast',
    role: 'publisher',
    publish: true,
    userName: profile?.display_name || user?.email,
    identity: user?.id || 'broadcaster',
    onUserJoined: () => {},
    onUserLeft: () => {},
    onError: (err) => console.error('[broadcaster]', err),
  })

  useEffect(() => {
    if (!user?.id) {
      navigate('/xtrollz', { replace: true })
      return
    }
    const fetchActiveStream = async () => {
      const { data } = await supabase
        .from('xtrollz_streams')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['starting', 'live'])
        .maybeSingle()
      if (data) {
        setStream(data)
        if (data.status === 'live') setIsLive(true)
      } else {
        setError('No active broadcast found')
      }
      setLoading(false)
    }
    void fetchActiveStream()
  }, [user?.id, navigate])

  useEffect(() => {
    if (!stream?.livekit_room_name) return
    const token = 'xtrollz-broadcaster-override'
    void joinAsPublisher(user?.id || '', token)
  }, [stream?.livekit_room_name, user?.id, joinAsPublisher])

  useEffect(() => {
    const track = localVideoTrack
    if (track && videoRef.current) {
      videoRef.current.srcObject = new MediaStream([track.mediaStreamTrack])
      videoRef.current.play().catch(() => {})
    }
  }, [localVideoTrack])

  const handleGoLive = async () => {
    if (!stream?.id) return
    const { error } = await supabase.rpc('xtrollz_update_stream_status', {
      p_stream_id: stream.id,
      p_user_id: user?.id,
      p_status: 'live',
    })
    if (error) {
      toast.error('Failed to go live')
      return
    }
    setIsLive(true)
    setStream((prev: any) => ({ ...prev, status: 'live' }))
    toast.success('You are now live!')
  }

  const handleEndStream = async () => {
    if (!stream?.id) return
    const { error } = await supabase.rpc('xtrollz_end_broadcast', {
      p_stream_id: stream.id,
      p_user_id: user?.id,
    })
    if (error) {
      toast.error('Failed to end stream')
      return
    }
    leaveRoom()
    setIsLive(false)
    navigate('/xtrollz', { replace: true })
  }

  const handleChatSend = async () => {
    if (!chatInput.trim() || !stream?.id) return
    const { error } = await supabase.from('xtrollz_stream_messages').insert({
      stream_id: stream.id,
      user_id: user!.id,
      body: chatInput.trim(),
      sender_name: profile?.display_name || user?.email,
    })
    if (error) return
    setChatMessages((prev) => [...prev, { body: chatInput.trim(), sender_name: profile?.display_name || 'You', is_me: true }])
    setChatInput('')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0814] text-white">
        <div className="animate-pulse px-6 py-3 rounded bg-[#121212] border border-[#2C2C2C]">Loading studio...</div>
      </div>
    )
  }

  const errorMessage = error || lkError

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-purple-950/40 to-slate-950 text-white">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/xtrollz')} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10">
              <ArrowLeft size={16} /> Back
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-400/30 bg-purple-500/10">
                <Radio size={16} className="text-purple-300" />
              </div>
              <span className="text-sm font-black">Broadcaster Studio</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </span>
            )}
            {!isLive ? (
              <button onClick={handleGoLive} className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-black text-white hover:bg-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.35)]">
                <Radio size={14} /> Go Live
              </button>
            ) : (
              <button onClick={handleEndStream} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-500">
                <Power size={14} /> End Stream
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-7xl flex-1 flex-col gap-4 px-4 py-4 lg:flex-row">
        <div className="flex-1">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
            <video ref={videoRef} autoPlay muted className="h-full w-full object-cover" />
            {!isConnected && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="animate-pulse px-4 py-2 rounded bg-black/50 border border-white/10 text-xs font-bold text-white">Connecting to room...</div>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setMicEnabled((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold ${micEnabled ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : 'border-red-400/30 bg-red-500/10 text-red-400'}`}
            >
              {micEnabled ? <Mic size={14} /> : <MicOff size={14} />}
              {micEnabled ? 'Mute' : 'Unmute'}
            </button>
            <button
              onClick={() => setCamEnabled((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold ${camEnabled ? 'border-white/10 bg-white/5 text-white hover:bg-white/10' : 'border-red-400/30 bg-red-500/10 text-red-400'}`}
            >
              {camEnabled ? <Video size={14} /> : <VideoOff size={14} />}
              {camEnabled ? 'Stop Cam' : 'Start Cam'}
            </button>
          </div>

          {errorMessage && (
            <div className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-300">
              {errorMessage}
            </div>
          )}
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
          <div className="border-t border-white/10 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                placeholder="Send a message..."
                className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
              />
              <button onClick={handleChatSend} className="rounded-xl bg-purple-600 px-3 py-2 text-white hover:bg-purple-500">
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
