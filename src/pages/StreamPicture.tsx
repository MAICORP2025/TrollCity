import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TrollCitySpinner } from '../components/TrollCitySpinner'

type StreamRow = {
  id: string
  title?: string | null
  current_viewers?: number | null
  user_profiles?: {
    username?: string | null
    avatar_url?: string | null
  } | null
}

export default function StreamPicture() {
  const { streamId } = useParams()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const fetchStream = useCallback(async (): Promise<StreamRow | null> => {
    if (!streamId) return null
    const { data, error } = await supabase
      .from('streams')
      .select(`
        id,
        title,
        current_viewers,
        user_profiles!broadcaster_id (
          username,
          avatar_url
        )
      `)
      .eq('id', streamId)
      .maybeSingle()
    if (error) {
      setError('Failed to load stream')
      return null
    }
    const normalized = data
      ? {
          ...data,
          user_profiles: Array.isArray(data.user_profiles) ? data.user_profiles[0] : data.user_profiles
        }
      : null
    return normalized as any
  }, [streamId])

  const avatarSrcFor = (s: StreamRow | null) => {
    const username = s?.user_profiles?.username || 'troll'
    return s?.user_profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
  }

  const drawPicture = useCallback(async (s: StreamRow | null) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = 800
    const h = 450
    canvas.width = w
    canvas.height = h

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = avatarSrcFor(s)

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image load failed'))
    }).catch(() => {})

    if (img.width > 0 && img.height > 0) {
      const ratio = Math.max(w / img.width, h / img.height)
      const drawW = img.width * ratio
      const drawH = img.height * ratio
      const dx = (w - drawW) / 2
      const dy = (h - drawH) / 2
      ctx.drawImage(img, dx, dy, drawW, drawH)
    }

    const grd = ctx.createLinearGradient(0, h, 0, h * 0.5)
    grd.addColorStop(0, 'rgba(0,0,0,0.85)')
    grd.addColorStop(1, 'rgba(0,0,0,0.2)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px Inter, system-ui, -apple-system, Segoe UI, Roboto'
    const title = s?.title || 'Live Stream'
    ctx.fillText(title, 24, h - 110, w - 48)

    ctx.font = '600 18px Inter, system-ui, -apple-system, Segoe UI, Roboto'
    const username = s?.user_profiles?.username ? `@${s.user_profiles.username}` : '@unknown'
    ctx.fillStyle = '#d1d5db'
    ctx.fillText(username, 24, h - 80)

    ctx.fillStyle = '#ef4444'
    ctx.fillRect(24, 24, 64, 28)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px Inter, system-ui, -apple-system, Segoe UI, Roboto'
    ctx.fillText('LIVE', 42, 43)

    ctx.fillStyle = '#22d3ee'
    ctx.font = 'bold 16px Inter, system-ui, -apple-system, Segoe UI, Roboto'
    const viewers = s?.current_viewers ?? 0
    ctx.fillText(`${viewers} watching`, w - 180, 43)

    const url = canvas.toDataURL('image/png')
    setImageUrl(url)
  }, [])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      setError(null)
      setImageUrl(null)
      const s = await fetchStream()
      await drawPicture(s)
      if (mounted) setLoading(false)
    }
    run()
    return () => {
      mounted = false
    }
  }, [streamId, fetchStream, drawPicture])

  const download = () => {
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `stream-${streamId}.png`
    a.click()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white flex items-center justify-center">
        <TrollCitySpinner text="Rendering Stream Picture..." subtext="Generating image preview" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div>{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F0517] via-[#1A0A26] to-[#0D0411] text-white p-6 flex flex-col items-center gap-6">
      <canvas ref={canvasRef} className="hidden" />
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Stream Picture"
          className="rounded-2xl border border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.35)]"
          style={{ width: 800, height: 450 }}
        />
      )}
      <button
        onClick={download}
        className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:brightness-110 transition-colors"
      >
        Download Image
      </button>
    </div>
  )
}
