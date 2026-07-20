// Universe-only Mux playback player. This component is STRICTLY scoped to
// Universe Battles — it is never imported by any other feature. Viewers watch
// the broadcaster via Mux (low-latency HLS). Active participants publish over
// LiveKit (see UniverseLiveKitStage). We use hls.js with low-latency tuning so
// playback latency is as small as the Mux LL-HLS endpoint allows.
import React, { useEffect, useRef } from 'react'
import Hls from 'hls.js'

interface UniverseMuxPlayerProps {
  playbackId?: string | null
  className?: string
  muted?: boolean
}

export default function UniverseMuxPlayer({ playbackId, className, muted }: UniverseMuxPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el || !playbackId) return

    const src = `https://stream.mux.com/${playbackId}.m3u8`
    el.muted = !!muted
    el.playsInline = true

    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS (Safari / iOS) — uses LL-HLS automatically when available.
      el.src = src
      el.play().catch(() => {})
      return
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Low-latency tuning: chase the live edge aggressively.
        lowLatencyMode: true,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
        maxLiveSyncPlaybackRate: 1.5,
        backBufferLength: 6,
        // Keep startup snappy.
        capLevelToPlayerSize: true,
        startLevel: -1,
      })
      hls.loadSource(src)
      hls.attachMedia(el)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        el.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data?.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError()
              break
            default:
              hls.destroy()
              break
          }
        }
      })
      return () => hls.destroy()
    }

    // Final fallback: let the browser try the raw URL.
    el.src = src
    el.play().catch(() => {})
  }, [playbackId, muted])

  if (!playbackId) {
    return (
      <div className={`flex items-center justify-center bg-zinc-950 ${className || ''}`}>
        <span className="text-xs text-slate-500">Waiting for broadcast…</span>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      className={`h-full w-full object-cover bg-black ${className || ''}`}
      muted={muted}
      playsInline
      autoPlay
    />
  )
}
