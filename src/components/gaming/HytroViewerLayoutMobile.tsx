import React, { useEffect, useRef, useState, useCallback } from 'react'
import GamingChat from '@/components/broadcast/GamingChat'
import { useAgoraGamingViewer } from '@/hooks/useAgoraGamingViewer'
import { useAuthStore } from '@/lib/store'
import { sendGift } from '@/lib/gifts'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Eye, Gamepad2, Mic, MonitorPlay, Radio, Users, Video, Coins, Heart } from 'lucide-react'

interface HytroViewerLayoutMobileProps {
  stream: any
  currentUser: any
  allowJoinBattle: boolean
  hasEnded?: boolean
}

export default function HytroViewerLayoutMobile({ stream, currentUser, allowJoinBattle, hasEnded }: HytroViewerLayoutMobileProps) {
  const videoContainerRef = useRef<HTMLDivElement>(null)
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
  const cameraContainerRef = useRef<HTMLDivElement>(null)
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

    const viewerIdentity = `viewer-${stream.id}-${currentUser?.id || 'anon'}`
    join(channelName, viewerIdentity)

    return () => {
      leave()
    }
  }, [stream?.agora_channel, stream?.id, currentUser?.id, join, leave])

  useEffect(() => {
    if (!remoteVideoTrack || !videoContainerRef.current) return

    videoContainerRef.current.innerHTML = ''
    try {
      remoteVideoTrack.play(videoContainerRef.current, { fit: 'contain' })
    } catch (_) {}

    return () => {
      videoContainerRef.current?.replaceChildren()
    }
  }, [remoteVideoTrack])

  useEffect(() => {
    const node = cameraContainerRef.current
    if (!node || !remoteCameraTrack) return

    node.innerHTML = ''
    try {
      remoteCameraTrack.play(node, { fit: 'cover' })
    } catch (_) {}

    return () => {
      node.innerHTML = ''
    }
  }, [remoteCameraTrack])

  useEffect(() => {
    if (!remoteAudioTrack) return
    try {
      ;(remoteAudioTrack as any).play().catch(() => {})
    } catch (err) {
      console.warn('[HytroViewerLayoutMobile] Failed to play Agora audio track:', err)
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
      <header className="border-b border-cyan-400/15 bg-black/35 px-4 py-3 backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-400/10">
              <Gamepad2 className="h-5 w-5 text-cyan-200" />
            </div>
            <div>
              <div className="text-base font-black italic tracking-tight">
                <span className="text-cyan-300">Troll</span>{' '}
                <span className="bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent">City</span>
              </div>
              <div className="text-[10px] font-bold text-emerald-300">HytroGaming</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                LIVE
              </span>
            )}
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Eye className="h-3 w-3 text-cyan-300" />
              {viewerCount.toLocaleString()}
            </div>
          </div>
        </div>
      </header>

      <main className="px-3 pb-20 pt-3 space-y-3">
        {/* ── Main Video ── */}
        <div className="w-full aspect-video rounded-xl bg-black overflow-hidden relative border border-white/6">
          {remoteVideoTrack ? (
            <div ref={videoContainerRef} className="h-full w-full" />
          ) : isConnecting ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
              <p className="text-xs font-bold">Connecting...</p>
            </div>
          ) : isConnected ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
              <MonitorPlay className="h-10 w-10 text-cyan-300/30" />
              <p className="text-xs font-bold">Waiting for broadcaster...</p>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-xs text-red-400 px-4 text-center">{error}</div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
              <MonitorPlay className="h-10 w-10 text-cyan-300/30" />
              <p className="text-xs font-bold">Stream offline</p>
            </div>
          )}

          {/* Camera overlay */}
          {remoteCameraTrack && (
            <div className="absolute right-2.5 top-2.5 z-20 w-36 overflow-hidden rounded-lg border-2 border-white/15 bg-black/70 shadow-xl backdrop-blur-sm">
              <div ref={cameraContainerRef} className="h-20 w-full bg-slate-900" />
              <div className="flex items-center gap-1 px-1.5 py-0.5">
                <span className="h-1 w-1 animate-pulse rounded-full bg-red-400" />
                <span className="text-[8px] font-bold text-white/70">{stream?.broadcaster_username || 'Host'}</span>
              </div>
            </div>
          )}

          {/* Broadcaster overlay — bottom left */}
          <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-2 rounded-lg border border-white/10 bg-black/60 px-2 py-1.5 backdrop-blur-xl">
            {stream?.broadcaster_avatar ? (
              <img src={stream.broadcaster_avatar} alt="" className="h-6 w-6 rounded-md border border-purple-300/30 object-cover" />
            ) : (
              <div className="grid h-6 w-6 place-items-center rounded-md border border-purple-300/30 bg-purple-500/20 text-[8px] font-black">
                {(stream?.broadcaster_username || 'H').slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-[9px] font-black">{stream?.broadcaster_username || 'Host'}</span>
          </div>
        </div>

        {/* ── Broadcaster + Stream Info ── */}
        <div className="rounded-xl border border-white/6 bg-black/40 p-3">
          <div className="flex items-center gap-3">
            {stream?.broadcaster_avatar ? (
              <img src={stream.broadcaster_avatar} alt="" className="h-10 w-10 rounded-lg border border-purple-300/40 object-cover" />
            ) : (
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-purple-300/40 bg-gradient-to-br from-purple-600 to-cyan-500 text-xs font-black">
                {(stream?.broadcaster_username || 'H').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{stream?.broadcaster_username || 'Host'}</p>
              <p className="text-[10px] font-bold text-cyan-300">{stream?.game_title || 'Gaming'}</p>
            </div>
            {stream?.game_title && (
              <div className="flex items-center gap-1 rounded-md border border-cyan-400/20 bg-cyan-400/5 px-2 py-1">
                <Gamepad2 className="h-3 w-3 text-cyan-300" />
                <span className="text-[9px] font-bold text-cyan-200">{stream.game_title}</span>
              </div>
            )}
          </div>
          {stream?.description && (
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{stream.description}</p>
          )}
        </div>

        {/* ── Connection Status ── */}
        <div className="flex items-center gap-2">
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

        {/* ── Live Chat ── */}
        <div className="rounded-xl border border-white/6 bg-black/50 p-2.5">
          <div className="flex items-center justify-between px-1 pb-2">
            <div className="text-[10px] font-black uppercase text-slate-400">Live Chat</div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <Users className="h-3 w-3" />
              {viewerCount.toLocaleString()}
            </div>
          </div>
          <div className="h-64 overflow-hidden rounded-lg bg-black/30">
            <GamingChat streamId={stream.id} />
          </div>
        </div>

        {/* ── Tip the Streamer ── */}
        <div className="rounded-xl border border-white/6 bg-black/40 p-3">
          <div className="text-[10px] font-black uppercase text-slate-400">Support Streamer</div>
          {!showTipPanel ? (
            <button
              onClick={() => setShowTipPanel(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 py-2 text-[10px] font-black text-amber-200"
            >
              <Coins className="h-3.5 w-3.5" />
              Send Tip
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-1">
                {[10, 50, 100, 500].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTipAmount(amt)}
                    className={cn(
                      'flex-1 rounded-md border py-1 text-[9px] font-black',
                      tipAmount === amt
                        ? 'border-amber-400/40 bg-amber-400/20 text-amber-200'
                        : 'border-white/10 bg-white/[0.04] text-slate-400'
                    )}
                  >
                    {amt}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Coins className="h-3 w-3 text-amber-300" />
                <input
                  type="number"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  min={1}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white outline-none"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowTipPanel(false)}
                  className="flex-1 rounded-md border border-white/10 py-1.5 text-[9px] font-bold text-slate-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleTip()}
                  disabled={tipping}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 py-1.5 text-[9px] font-black text-white disabled:opacity-50"
                >
                  {tipping ? (
                    <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <><Heart className="h-2.5 w-2.5" /> Send</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-slate-500">Battles disabled for HytroGaming viewers.</div>
      </main>
    </div>
  )
}
