import { useEffect, useRef } from 'react'
import { issuePromoCard } from '../lib/issuePromoCard'

export function usePromoCardWatchReward(
  streamId: string | null,
  isHost: boolean,
  userId: string | null,
) {
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!streamId || isHost || !userId) return

    const WATCH_REWARD_DELAY_MS = clampWatchDelay()

    timerRef.current = window.setTimeout(async () => {
      try {
        const result = await issuePromoCard({
          user_id: userId,
          source_type: 'broadcast_watch',
          token_amount: 10,
          metadata: { streamId, source: 'broadcast_watch' },
        })

          if (result.success && result.promo_card_id) {
            window.dispatchEvent(
              new CustomEvent('promo-card-issued', {
                detail: {
                  promo_card_id: result.promo_card_id,
                  code: result.code,
                  token_amount: result.token_amount,
                  expires_at: result.expires_at,
                  source_type: 'broadcast_watch',
                },
              }),
            )
          }

          if (!result.success && result.error === 'COOLDOWN_ACTIVE' && result.next_available_at) {
            window.dispatchEvent(
              new CustomEvent('promo-card-cooldown', {
                detail: {
                  message: result.message || 'Cooldown active',
                  next_available_at: result.next_available_at,
                  source_type: 'broadcast_watch',
                },
              }),
            )
          }
      } catch (err) {
        console.error('[PromoCard] Watch reward failed:', err)
      }
    }, WATCH_REWARD_DELAY_MS)

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [streamId, isHost, userId])
}

function clampWatchDelay(): number {
  const envDelay = import.meta.env.VITE_MAITALENT_WATCH_REWARD_DELAY_MS
  const parsed = Number(envDelay)
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.min(parsed, 300_000)
  }
  return 30_000
}
