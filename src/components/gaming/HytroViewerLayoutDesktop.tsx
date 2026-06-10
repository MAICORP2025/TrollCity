import React, { useEffect, useRef, useState, useCallback } from 'react'
import GamingChat from '@/components/broadcast/GamingChat'
import AudienceBubbleTicker from '@/components/broadcast/AudienceBubbleTicker'
import { useAgoraGamingViewer } from '@/hooks/useAgoraGamingViewer'
import { useAuthStore } from '@/lib/store'
import { sendGift } from '@/lib/gifts'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Eye,
  Gamepad2,
  Mic,
  MonitorPlay,
  Radio,
  Users,
  Video,
  Coins,
  Heart,
} from 'lucide-react'

interface HytroViewerLayoutDesktopProps {
  stream: any
  currentUser: any
  allowJoinBattle: boolean
  hasEnded?: boolean
}

export default function HytroViewerLayoutDesktop({ stream, currentUser, allowJoinBattle, hasEnded }: HytroViewerLayoutDesktopProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const cameraContainerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuthStore()
  const [tipping, setTipping] = useState(false)
  const [tipAmount, setTipAmount] = useState(10)
  const [showTipPanel, setShowTipPanel] = useState(false)

  const handleTip = useCallback(async () => {
    if (!user) {
      toast.error('Sign in to tip')
      return
    }
    if (!stream?.user_id) {
      toast.error('Cannot tip this stream')
      return
    }
    if (tipAmount < 1) {
      toast.error('Minimum tip is 1 coin')
      return
    }

    setTipping(true)
    try {
      const success = await sendGift(user.id, stream.user_id, tipAmount, 'Tip')
      if (success) {
        toast.success(`Tipped ${tipAmount} troll coins to ${stream?.broadcaster_username || 'the streamer'}!`)
        setShowTipPanel(false)
      }
    } catch (err: any) {
      console.error('[Tip] Failed:', err)
      toast.error('Tip failed. Please try again.')
    } finally {
      setTipping(false)
    }
  }, [user, stream, tipAmount])

  const {
    isConnecting,
    isConnected,
    remoteVideoTrack,
    remoteCameraTrack,
    remoteAudioTrack,
    error,
    join,
    leave,
  } = useAgoraGamingViewer()

  useEffect(() => {
    const channelName = stream?.agora_channel || stream?.id
    if (!channelName) return

    console.log('[HytroViewerLayoutDesktop] mounting', { streamId: stream?.id, channel: channelName })
    void join(channelName, currentUser?.id || `anon-${stream?.id}`)
    return () => {
      void leave()
    }
  }, [stream?.agora_channel, stream?.id, currentUser?.id, join, leave])

  // Play screen share video track with contain fit (no zoom/crop)
  useEffect(() => {
    const node = videoContainerRef.current
    if (!node || !remoteVideoTrack) return

    node.innerHTML = ''
    try {
      remoteVideoTrack.play(node, { fit: 'contain' })
    } catch (err: any) {
      console.warn('[HytroViewerLayoutDesktop] Failed to play Agora video track:', err)
    }

    return () => {
      node.innerHTML = ''
    }
  }, [remoteVideoTrack])

  // Play camera overlay track with cover fit (fills the small box)
  useEffect(() => {
    const node = cameraContainerRef.current
    if (!node || !remoteCameraTrack) return

    node.innerHTML = ''
    try {
      remoteCameraTrack.play(node, { fit: 'cover' })
    } catch (err: any) {
      console.warn('[HytroViewerLayoutDesktop] Failed to play camera track:', err)
    }

    return () => {
      node.innerHTML = ''
    }
  }, [remoteCameraTrack])

  // Play audio track
  useEffect(() => {
    if (!remoteAudioTrack) return
    try {
      ;(remoteAudioTrack as any).play().catch(() => {})
    } catch (err) {
      console.warn('[HytroViewerLayoutDesktop] Failed to play Agora audio track:', err)
    }
  }, [remoteAudioTrack])

  const isLive = stream?.status === 'live' || stream?.is_live
  const viewerCount = stream?.current_viewers || 0

  return (
    <div className={cn(
      'min-h-screen overflow-hidden bg-[#05080f] text-white',
      'bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(168,85,247,0.12),transparent_30%),linear-gradient(180deg,#05080f,#02040a)]'
    )}>
      {/* ── Header ── */}
      <header className="border-b border-cyan-400/15 bg-black/35 px-4 py-3 backdrop-blur-2xl sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_25px_rgba(34,211,238,0.22)]">
                <Gamepad2 className="h-6 w-6 text-cyan-200" />
              </div>
              <div className="leading-none">
                <div className="text-2xl font-black italic tracking-tight">
                  <span className="text-cyan-300">Troll</span>{' '}
                  <span className="bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent">City</span>
                </div>
              </div>
            </div>
            <div className="hidden rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-5 py-2.5 text-sm font-black text-emerald-200 shadow-[0_0_24px_rgba(74,222,128,0.18)] md:flex md:items-center md:gap-2">
              <Gamepad2 className="h-4 w-4" />
              HytroGaming
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-black text-red-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                LIVE
              </span>
            )}
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
              <Eye className="h-3.5 w-3.5 text-cyan-300" />
              {viewerCount.toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Grid — matches GamingSetup 3-column layout ── */}
      <main className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[340px_minmax(560px,1fr)_340px] 2xl:grid-cols-[380px_minmax(680px,1fr)_380px]">

        {/* ── Left Column: Stream Info + Broadcaster ── */}
        <section className="space-y-4">
          {/* Broadcaster Card */}
          <div className="rounded-2xl border border-white/6 bg-black/40 p-4">
            <div className="flex items-center gap-3">
              {stream?.broadcaster_avatar ? (
                <img src={stream.broadcaster_avatar} alt={stream?.broadcaster_username} className="h-12 w-12 rounded-xl border border-purple-300/40 object-cover" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-purple-300/40 bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black">
                  {(stream?.broadcaster_username || 'H').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{stream?.broadcaster_username || 'Host'}</p>
                <p className="text-xs font-bold text-cyan-300">{stream?.game_title || 'Gaming'}</p>
              </div>
            </div>
          </div>

          {/* Stream Details */}
          <div className="rounded-2xl border border-white/6 bg-black/40 p-4">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-400">Stream Details</h3>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-sm font-black">{stream?.title || 'Live Gaming Stream'}</p>
                <p className="mt-1 text-xs text-slate-400">{stream?.description || 'NO description provided.'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/6 bg-black/30 p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Engine</p>
                  <p className="mt-0.5 text-xs font-black text-cyan-300">Agora RTC</p>
                </div>
                <div className="rounded-xl border border-white/6 bg-black/30 p-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase text-slate-500">Latency</p>
                  <p className="mt-0.5 text-xs font-black text-emerald-300">&lt; 1s</p>
                </div>
              </div>
            </div>
          </div>

          {/* Connection Status */}
          <div className="rounded-2xl border border-white/6 bg-black/40 p-4">
            <h3 className="text-xs font-black uppercase tracking-wide text-slate-400">Connection</h3>
            <div className="mt-3 flex items-center gap-3">
              <div className={cn(
                'relative grid h-12 w-12 place-items-center rounded-full border bg-black',
                remoteVideoTrack ? 'border-emerald-400/40 shadow-[0_0_20px_rgba(74,222,128,0.2)]' :
                isConnecting ? 'border-cyan-400/40' : 'border-slate-600'
              )}>
                <MonitorPlay className={cn(
                  'h-5 w-5',
                  remoteVideoTrack ? 'text-emerald-300' : isConnecting ? 'text-cyan-300' : 'text-slate-500'
                )} />
                {remoteVideoTrack && (
                  <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white">
                    <Radio className="h-2 w-2" />
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-black">
                  {remoteVideoTrack ? 'Receiving Stream' : isConnecting ? 'Connecting...' : isConnected ? 'Waiting for broadcaster...' : 'Connecting...'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {remoteVideoTrack ? 'Screen share active' : error || 'Joining Agora channel...'}
                </p>
              </div>
            </div>
            {/* Track indicators */}
            <div className="mt-3 flex gap-2">
              <span className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                remoteVideoTrack ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/[0.04] text-slate-500'
              )}>
                <Video className="h-2.5 w-2.5" /> Screen
              </span>
              <span className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                remoteCameraTrack ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/[0.04] text-slate-500'
              )}>
                <Video className="h-2.5 w-2.5" /> Cam
              </span>
              <span className={cn(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold',
                remoteAudioTrack ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/[0.04] text-slate-500'
              )}>
                <Mic className="h-2.5 w-2.5" /> Audio
              </span>
            </div>
          </div>
        </section>

        {/* ── Center Column: Video + Chat ── */}
        <section className="space-y-4">
          {/* Main Video — Screen Share */}
          <div className="rounded-2xl border border-white/6 bg-black/60 p-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2 text-xs font-black">
                <MonitorPlay className="h-4 w-4 text-cyan-300" />
                {stream?.title || 'Live Gaming Stream'}
              </div>
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className="flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                    LIVE
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                  <Eye className="h-3 w-3" />
                  {viewerCount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              {remoteVideoTrack ? (
                <div ref={videoContainerRef} className="h-full w-full" />
              ) : isConnecting ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                  <p className="text-sm font-bold">Connecting to stream...</p>
                </div>
              ) : isConnected ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <MonitorPlay className="h-12 w-12 text-cyan-300/30" />
                  <p className="text-sm font-bold">Waiting for broadcaster...</p>
                  <p className="text-xs text-slate-600">The stream will appear here once the host starts sharing</p>
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-red-400">
                  <p className="text-sm font-bold">{error}</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <MonitorPlay className="h-12 w-12 text-cyan-300/30" />
                  <p className="text-sm font-bold">Stream offline</p>
                </div>
              )}

              {/* Camera overlay — positioned like OBS, top-right corner */}
              {remoteCameraTrack && (
                <div className="absolute right-4 top-4 z-20 w-52 overflow-hidden rounded-xl border-2 border-white/15 bg-black/70 shadow-2xl backdrop-blur-sm">
                  <div ref={cameraContainerRef} className="h-28 w-full bg-slate-900" />
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                    <span className="text-[9px] font-bold text-white/70">{stream?.broadcaster_username || 'Host'}</span>
                  </div>
                </div>
              )}

              {/* Broadcaster info overlay — bottom left */}
              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-xl">
                {stream?.broadcaster_avatar ? (
                  <img src={stream.broadcaster_avatar} alt="" className="h-8 w-8 rounded-lg border border-purple-300/30 object-cover" />
                ) : (
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-purple-300/30 bg-purple-500/20 text-[10px] font-black">
                    {(stream?.broadcaster_username || 'H').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-black uppercase">{stream?.broadcaster_username || 'Host'}</p>
                  <div className="mt-0.5 h-1.5 w-24 rounded-full bg-white/15">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Chat */}
          <div className="rounded-2xl border border-white/6 bg-black/40 p-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-black uppercase text-slate-400">Live Chat</div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <Users className="h-3 w-3" />
                {viewerCount.toLocaleString()} watching
              </div>
            </div>
            <div className="h-[320px] overflow-hidden rounded-xl bg-black/30">
              <GamingChat streamId={stream.id} />
            </div>
          </div>
        </section>

        {/* ── Right Column: Stats + Info ── */}
        <aside className="col-span-1 flex flex-col gap-4">
          {/* Stream Health */}
          <div className="rounded-2xl border border-white/6 bg-black/40 p-4">
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">Stream Health</h4>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Quality</span>
                <span className="text-[10px] font-bold text-emerald-300">1080p60</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Latency</span>
                <span className="text-[10px] font-bold text-cyan-300">38ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Status</span>
                <span className={cn(
                  'text-[10px] font-bold',
                  remoteVideoTrack ? 'text-emerald-300' : isConnecting ? 'text-cyan-300' : 'text-slate-500'
                )}>
                  {remoteVideoTrack ? 'Excellent' : isConnecting ? 'Connecting' : 'Waiting'}
                </span>
              </div>
            </div>
          </div>

          {/* Tip the Streamer */}
          <div className="rounded-2xl border border-white/6 bg-black/40 p-4">
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">Support Streamer</h4>
            <p className="mt-1 text-[10px] text-slate-500">Send troll coins to support this stream</p>
            {!showTipPanel ? (
              <button
                onClick={() => setShowTipPanel(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-2.5 text-xs font-black text-amber-200 transition hover:from-amber-500/30 hover:to-orange-500/30"
              >
                <Coins className="h-4 w-4" />
                Send Tip
              </button>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  {[10, 50, 100, 500].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setTipAmount(amt)}
                      className={cn(
                        'flex-1 rounded-lg border py-1.5 text-[10px] font-black transition',
                        tipAmount === amt
                          ? 'border-amber-400/40 bg-amber-400/20 text-amber-200'
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]'
                      )}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="h-3.5 w-3.5 text-amber-300" />
                  <input
                    type="number"
                    value={tipAmount}
                    onChange={(e) => setTipAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white outline-none focus:border-amber-400/30"
                    placeholder="Custom amount"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowTipPanel(false)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[10px] font-bold text-slate-400 hover:bg-white/[0.08]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleTip()}
                    disabled={tipping}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-[10px] font-black text-white transition hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
                  >
                    {tipping ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <><Heart className="h-3 w-3" /> Send Tip</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* About This Stream */}
          <div className="rounded-2xl border border-white/6 bg-black/40 p-4">
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">About</h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              {stream?.description || 'No description provided.'}
            </p>
            {stream?.game_title && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1.5">
                <Gamepad2 className="h-3.5 w-3.5 text-cyan-300" />
                <span className="text-[10px] font-bold text-cyan-200">{stream.game_title}</span>
              </div>
            )}
          </div>

          {/* Top Fans placeholder */}
          <div className="rounded-2xl border border-white/6 bg-black/40 p-4">
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">Top Fans</h4>
            <div className="mt-3 space-y-2">
              {['NeoNinja', 'PixelQueen', 'CyberWolf'].map((name, i) => (
                <div key={name} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500">{i + 1}.</span>
                  <span className="text-xs font-bold text-slate-300">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Battle (View Only) */}
          <div className="rounded-2xl border border-white/6 bg-black/40 p-4">
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-400">Battle</h4>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-gradient-to-b from-cyan-700/10 to-transparent p-2.5">
                <div className="text-[10px] font-black text-cyan-300">Team Troll</div>
                <div className="mt-0.5 text-lg font-black">—</div>
              </div>
              <div className="rounded-lg bg-gradient-to-b from-purple-700/10 to-transparent p-2.5">
                <div className="text-[10px] font-black text-purple-300">Team Beast</div>
                <div className="mt-0.5 text-lg font-black">—</div>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Battle is view-only for HytroGaming viewers.</p>
          </div>
        </aside>
      </main>

      {/* ── Footer Ticker ── */}
      <footer className="fixed bottom-4 left-0 right-0 pointer-events-none">
        <div className="mx-auto max-w-7xl px-6">
          <AudienceBubbleTicker streamId={stream.id} audience={[]} currentUserId={currentUser?.id} hostUserId={stream.user_id} />
        </div>
      </footer>
    </div>
  )
}
