import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gift } from 'lucide-react'
import { getGiftVisualConfig } from '../../lib/giftVisuals'
import { supabase } from '@/lib/supabase'
import type { BroadcastGift } from '../../hooks/useBroadcastRealtime'

interface GiftVideoOverlayProps {
  gifts: BroadcastGift[]
  onFinish: (giftId: string) => void
  nameMap?: Record<string, string>
}

type GiftVisualConfig = ReturnType<typeof getGiftVisualConfig>

type ResolvedOverlayMedia = {
  url: string | null
  type: 'video' | 'image' | 'missing'
  source: string
}

const DEFAULT_DURATION_MS = 4500

async function logGiftAnimationTest({
  gift,
  visual,
  resolvedUrl,
  resolvedSource,
  status,
  errorCode,
  errorMessage,
}: {
  gift: BroadcastGift
  visual: GiftVisualConfig
  resolvedUrl?: string | null
  resolvedSource?: string | null
  status: 'loaded' | 'failed' | 'missing'
  errorCode?: string | null
  errorMessage?: string | null
}) {
  try {
    await supabase.from('gift_animation_test_logs').insert({
      gift_id: gift.id || null,
      gift_item_id: (gift as any).gift_id || null,
      gift_name: gift.gift_name || null,
      slug: (gift as any).slug || null,
      gift_slug: gift.gift_slug || null,
      animation_url: gift.animation_url || null,
      resolved_url: resolvedUrl || null,
      resolved_source: resolvedSource || null,
      status,
      error_code: errorCode || null,
      error_message: errorMessage || null,
      stream_id: (gift as any).stream_id || null,
      sender_id: gift.sender_id || null,
      receiver_id: gift.receiver_id || null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
  } catch (error) {
    console.warn('[GiftVideoOverlay] Failed to write animation test log', error)
  }
}

function getGiftLabel(gift: BroadcastGift, visual: GiftVisualConfig) {
  return (
    gift.gift_name ||
    (visual as any).trayLabel ||
    (visual as any).label ||
    gift.gift_slug ||
    (gift as any).slug ||
    'Gift'
  )
}

function getGiftIcon(gift: BroadcastGift) {
  return gift.gift_icon || (gift as any).icon || '🎁'
}

function getSenderName(gift: BroadcastGift, nameMap: Record<string, string>) {
  return nameMap[gift.sender_id] || gift.sender_name || 'Someone'
}

function getReceiverName(gift: BroadcastGift, nameMap: Record<string, string>) {
  return nameMap[gift.receiver_id] || gift.receiver_name || 'the host'
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isLikelyVideoUrl(url?: string | null) {
  if (!url) return false

  const cleanUrl = url.split('?')[0].toLowerCase()

  return (
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.mov') ||
    cleanUrl.endsWith('.m4v') ||
    cleanUrl.endsWith('.ogv') ||
    cleanUrl.endsWith('.ogg')
  )
}

function isLikelyImageUrl(url?: string | null) {
  if (!url) return false

  const cleanUrl = url.split('?')[0].toLowerCase()

  return (
    cleanUrl.endsWith('.png') ||
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg') ||
    cleanUrl.endsWith('.gif') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.svg')
  )
}

function mediaTypeFromUrl(url: string | null): 'video' | 'image' {
  if (isLikelyImageUrl(url)) return 'image'
  return 'video'
}

function firstUrl(candidates: Array<[unknown, string]>): { url: string; source: string } | null {
  for (const [candidate, source] of candidates) {
    const url = cleanString(candidate)
    if (url) return { url, source }
  }

  return null
}

function resolveOverlayUrl(gift: BroadcastGift, visual: GiftVisualConfig): ResolvedOverlayMedia {
  const giftAny = gift as any
  const visualAny = visual as any
  const metadata = giftAny.metadata || {}

  // Check both snake_case (BroadcastGift / DB shape) and camelCase (normalisedGift /
  // giftAnimation.ts shape) so the overlay works no matter which path populated recentGifts
  const animUrl = gift.animation_url || giftAny.animationUrl || null
  const videoUrl = gift.video_url || giftAny.videoUrl || null
  const animation = animUrl || videoUrl || firstUrl([
    [metadata.animation_url, 'metadata.animation_url'],
    [metadata.video_url, 'metadata.video_url'],
    [metadata.resolved_url, 'metadata.resolved_url'],
    [metadata.resolvedVideoUrl, 'metadata.resolvedVideoUrl'],
    [visualAny.resolvedVideoUrl, 'visual.resolvedVideoUrl'],
    [visualAny.resolvedUrl, 'visual.resolvedUrl'],
    [visualAny.videoUrl, 'visual.videoUrl'],
    [visualAny.animationUrl, 'visual.animationUrl'],
    [visualAny.url, 'visual.url'],
  ])

  if (animation) {
    return {
      url: animation,
      type: mediaTypeFromUrl(animation),
      source: animUrl ? 'animation_url' : videoUrl ? 'video_url' : 'resolved',
    }
  }

  const imageResult = firstUrl([
    [giftAny.iconUrl || giftAny.icon_url, 'icon_url'],
    [giftAny.gift_icon_url, 'gift_icon_url'],
    [giftAny.trayVisualUrl || giftAny.tray_visual_url, 'tray_visual_url'],
    [metadata.icon_url || metadata.iconUrl, 'metadata.icon_url'],
    [metadata.gift_icon_url, 'metadata.gift_icon_url'],
    [metadata.tray_visual_url || metadata.trayVisualUrl, 'metadata.tray_visual_url'],
    [visualAny.trayVisualUrl, 'visual.trayVisualUrl'],
    [visualAny.iconUrl, 'visual.iconUrl'],
    [visualAny.imageUrl, 'visual.imageUrl'],
    [visualAny.resolvedImageUrl, 'visual.resolvedImageUrl'],
  ])

  if (imageResult?.url) {
    return {
      url: imageResult.url,
      type: isLikelyVideoUrl(imageResult.url) ? 'video' : 'image',
      source: imageResult.source,
    }
  }

  return {
    url: null,
    type: 'missing',
    source: 'missing',
  }
}

function MissingGiftFallback({
  gift,
  label,
  visual,
  reason,
}: {
  gift: BroadcastGift
  label: string
  visual: GiftVisualConfig
  reason: string
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl bg-gradient-to-br from-fuchsia-950 via-violet-950 to-cyan-950 px-6 text-center text-sm text-slate-100">
      <div className="rounded-full border border-cyan-300/30 bg-white/10 p-4 text-5xl shadow-[0_0_40px_rgba(34,211,238,0.28)]">
        {getGiftIcon(gift)}
      </div>

      <div className="text-base font-black uppercase tracking-[0.18em] text-white">
        Animation missing
      </div>

      <div className="max-w-xs text-xs text-slate-200">
        {label}
      </div>

      {import.meta.env.DEV && (
        <div className="max-w-md rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[10px] text-slate-300">
          <div>Reason: {reason}</div>
          <div>slug: {(visual as any).slug || (gift as any).slug || gift.gift_slug || 'none'}</div>
          <div>source: {(visual as any).resolvedSource || 'none'}</div>
        </div>
      )}
    </div>
  )
}

function GiftPreview({
  gift,
  visual,
  label,
}: {
  gift: BroadcastGift
  visual: GiftVisualConfig
  label: string
}) {
  const resolved = useMemo(() => resolveOverlayUrl(gift, visual), [gift, visual])
  const [videoFailed, setVideoFailed] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const triedPlayingRef = useRef(false)

  useEffect(() => {
    setVideoFailed(false)
    setImageFailed(false)
    triedPlayingRef.current = false
  }, [resolved.url, gift.id])

  useEffect(() => {
    if (!resolved.url || resolved.type === 'missing') {
      void logGiftAnimationTest({
        gift,
        visual,
        resolvedUrl: resolved.url,
        resolvedSource: resolved.source,
        status: 'missing',
        errorMessage: 'No resolved animation URL',
      })
    }
  }, [gift, resolved.url, resolved.source, resolved.type, visual])

  useEffect(() => {
    if (resolved.type !== 'video' || !resolved.url || !videoRef.current) return
    const video = videoRef.current

    const handleCanPlay = () => {
      if (triedPlayingRef.current) return
      video.play().catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[GiftVideoOverlay] autoplay on canplay failed', err)
        }
      })
    }

    const handlePlay = () => { triedPlayingRef.current = true }
    const handlePauseEndedError = () => { triedPlayingRef.current = false }

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePauseEndedError)
    video.addEventListener('ended', handlePauseEndedError)
    video.addEventListener('error', handlePauseEndedError)

    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePauseEndedError)
      video.removeEventListener('ended', handlePauseEndedError)
      video.removeEventListener('error', handlePauseEndedError)
    }
  }, [resolved.url, resolved.type, gift.id])

  if (!resolved.url || resolved.type === 'missing') {
    return (
      <MissingGiftFallback
        gift={gift}
        visual={visual}
        label={label}
        reason="No animation_url, video_url, metadata video URL, visual resolver URL, or icon URL available"
      />
    )
  }

  if (resolved.type === 'video' && !videoFailed) {
    return (
      <video
        key={`${gift.id}-${resolved.url}`}
        ref={videoRef}
        className="h-full w-full object-contain"
        src={resolved.url}
        autoPlay
        muted
        loop={false}
        playsInline
        preload="auto"
        onLoadedData={() => {
          if (import.meta.env.DEV) {
            console.info('[GiftVideoOverlay] media loaded', {
              giftId: gift.id,
              giftName: label,
              slug: (visual as any).slug || (gift as any).slug || gift.gift_slug || null,
              animation_url: gift.animation_url || null,
              resolvedUrl: resolved.url,
              resolvedSource: resolved.source,
            })
          }

          void logGiftAnimationTest({
            gift,
            visual,
            resolvedUrl: resolved.url,
            resolvedSource: resolved.source,
            status: 'loaded',
          })
        }}
        onError={(event) => {
          const videoEl = event.currentTarget
          const mediaError = videoEl.error

          console.error('[GiftVideoOverlay] video failed to load', {
            giftId: gift.id,
            giftName: label,
            slug: (visual as any).slug || (gift as any).slug || gift.gift_slug || null,
            animation_url: gift.animation_url || null,
            video_url: (gift as any).video_url || null,
            icon_url: (gift as any).icon_url || null,
            metadata: (gift as any).metadata || null,
            resolvedUrl: resolved.url,
            resolvedSource: resolved.source,
            errorCode: mediaError?.code || null,
            errorMessage: mediaError?.message || null,
            event,
          })

          void logGiftAnimationTest({
            gift,
            visual,
            resolvedUrl: resolved.url,
            resolvedSource: resolved.source,
            status: 'failed',
            errorCode: mediaError?.code ? String(mediaError.code) : null,
            errorMessage: mediaError?.message || null,
          })

          setVideoFailed(true)
        }}
      />
    )
  }

  if ((resolved.type === 'image' || videoFailed) && !imageFailed) {
    const fallbackImage = firstUrl([
      [resolved.type === 'image' ? resolved.url : null, resolved.source],
      [(gift as any).icon_url || (gift as any).iconUrl, 'icon_url_fallback'],
      [(gift as any).gift_icon_url, 'gift_icon_url_fallback'],
      [(gift as any).tray_visual_url || (gift as any).trayVisualUrl, 'tray_visual_url_fallback'],
      [((gift as any).metadata || {}).icon_url || ((gift as any).metadata || {}).iconUrl, 'metadata.icon_url_fallback'],
      [((gift as any).metadata || {}).tray_visual_url || ((gift as any).metadata || {}).trayVisualUrl, 'metadata.tray_visual_url_fallback'],
      [(visual as any).trayVisualUrl, 'visual.trayVisualUrl_fallback'],
      [(visual as any).iconUrl, 'visual.iconUrl_fallback'],
      [(visual as any).imageUrl, 'visual.imageUrl_fallback'],
    ])

    if (fallbackImage?.url) {
      return (
        <img
          key={`${gift.id}-${fallbackImage.url}`}
          className="h-full w-full object-contain"
          src={fallbackImage.url}
          alt={`${label} gift animation`}
          onLoad={() => {
            if (import.meta.env.DEV) {
              console.info('[GiftVideoOverlay] image loaded', {
                giftId: gift.id,
                giftName: label,
                resolvedUrl: fallbackImage.url,
                resolvedSource: fallbackImage.source,
              })
            }
          }}
          onError={(event) => {
            console.error('[GiftVideoOverlay] image failed to load', {
              giftId: gift.id,
              giftName: label,
              slug: (visual as any).slug || (gift as any).slug || gift.gift_slug || null,
              animation_url: gift.animation_url || null,
              video_url: (gift as any).video_url || null,
              icon_url: (gift as any).icon_url || null,
              metadata: (gift as any).metadata || null,
              resolvedUrl: fallbackImage.url,
              resolvedSource: fallbackImage.source,
              event,
            })

            setImageFailed(true)
          }}
        />
      )
    }
  }

  return (
    <MissingGiftFallback
      gift={gift}
      visual={visual}
      label={label}
      reason={videoFailed ? 'Video failed and no valid image fallback loaded' : 'Media failed to load'}
    />
  )
}

export default function GiftVideoOverlay({
  gifts,
  onFinish,
  nameMap = {},
}: GiftVideoOverlayProps) {
  const timersRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const activeGiftIds = new Set(gifts.map((gift) => gift.id))

    Object.keys(timersRef.current).forEach((giftId) => {
      if (!activeGiftIds.has(giftId)) {
        window.clearTimeout(timersRef.current[giftId])
        delete timersRef.current[giftId]
      }
    })

    gifts.forEach((gift) => {
      if (!gift?.id || timersRef.current[gift.id]) return

      const visual = getGiftVisualConfig(gift)
      const durationMs = gift.animation_duration_ms ?? visual.durationMs ?? DEFAULT_DURATION_MS

      timersRef.current[gift.id] = window.setTimeout(() => {
        onFinish(gift.id)
        delete timersRef.current[gift.id]
      }, durationMs + 150)
    })

    return () => {
      Object.values(timersRef.current).forEach((timerId) => window.clearTimeout(timerId))
      timersRef.current = {}
    }
  }, [gifts, onFinish])

  const displayGifts = useMemo(() => {
    const seenIds = new Set<string>()

    return gifts
      .slice(-3)
      .filter((gift) => {
        if (!gift?.id) return false
        if (seenIds.has(gift.id)) return false
        seenIds.add(gift.id)

        const giftAny = gift as any
        const metadata = giftAny.metadata || {}
        const slug = String(giftAny.slug || gift.gift_slug || '').trim()

        const hasAnyMedia =
          !!cleanString(giftAny.animationUrl) ||
          !!cleanString(giftAny.animation_url) ||
          !!cleanString(giftAny.videoUrl) ||
          !!cleanString(giftAny.video_url) ||
          !!cleanString(giftAny.icon_url) ||
          !!cleanString(giftAny.iconUrl) ||
          !!cleanString(giftAny.gift_icon_url) ||
          !!cleanString(giftAny.gift_icon) ||
          !!cleanString(giftAny.tray_visual_url) ||
          !!cleanString(giftAny.trayVisualUrl) ||
          !!cleanString(metadata.animation_url) ||
          !!cleanString(metadata.video_url) ||
          !!cleanString(metadata.icon_url) ||
          !!cleanString(metadata.iconUrl) ||
          !!cleanString(metadata.gift_icon_url) ||
          !!cleanString(metadata.tray_visual_url)

        const isGenericBoostPlaceholder = slug === 'gift_boost' && !hasAnyMedia

        return !isGenericBoostPlaceholder
      })
      .map((gift) => {
        const visual = getGiftVisualConfig(gift)
        const resolved = resolveOverlayUrl(gift, visual)
        const label = getGiftLabel(gift, visual)

        if (import.meta.env.DEV) {
          console.info('[GiftVideoOverlay] resolved gift media', {
            giftId: gift.id,
            giftName: label,
            slug: (gift as any).slug || gift.gift_slug,
            animation_url: gift.animation_url,
            video_url: (gift as any).video_url,
            icon_url: (gift as any).icon_url,
            metadata: (gift as any).metadata,
            resolvedUrl: resolved.url,
            resolvedType: resolved.type,
            resolvedSource: resolved.source,
          })
        }

        return {
          gift,
          visual,
          resolved,
          label,
        }
      })
  }, [gifts])

  if (!displayGifts.length) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[80] flex items-center justify-center px-4 py-6">
      <AnimatePresence mode="popLayout">
        {displayGifts.map(({ gift, visual, label, resolved }) => {
          const displayCount = gift.quantity && gift.quantity > 1 ? `×${gift.quantity}` : ''
          const senderName = getSenderName(gift, nameMap)
          const receiverName = getReceiverName(gift, nameMap)

          return (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-black/80 shadow-[0_0_40px_rgba(15,23,42,0.55)] backdrop-blur-xl"
            >
              <div className="relative aspect-[16/9] bg-slate-950">
                <GiftPreview gift={gift} visual={visual} label={label} />

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/90 sm:text-sm">
                    <span className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-pink-300" />
                      <span>{label}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {import.meta.env.DEV && (
                        <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] text-cyan-200">
                          {resolved.source}
                        </span>
                      )}

                      {displayCount && (
                        <span className="text-cyan-200">{displayCount}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 text-sm text-slate-200">
                    {senderName} sent {receiverName} a gift.
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
