import { useEffect } from 'react'

const VOICE_SOUND = '/sounds/you-got-a-gift.mp3'

export default function GiftSoundPlayer({ giftId }: { giftId: string }) {
  useEffect(() => {
    if (!giftId) return
    try {
      const mute = typeof window !== 'undefined' && localStorage.getItem('tc_mute_gift_sounds') === 'true'
      if (mute) return
      const streamSafe = typeof window !== 'undefined' && localStorage.getItem('tc_stream_safe_mode') === 'true'
      const audio = new Audio(VOICE_SOUND)
      audio.volume = streamSafe ? 0.15 : 0.35
      audio.play().catch((e) => {
        console.warn('Failed to play gift sound', VOICE_SOUND, e)
      })
    } catch (e) {
      console.warn('Gift sound playback error', e)
    }
  }, [giftId])

  return null
}
