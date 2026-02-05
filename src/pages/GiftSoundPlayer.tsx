import { useEffect } from 'react'

const SOUND_MAP: Record<string, string> = {
  'cash_toss': '/sounds/entrance/coins.mp3',
  'heart_pulse': '/sounds/heart.mp3',
  'fire_burst': '/sounds/entrance/flame.mp3',
  'applause': '/sounds/entrance/fanfare.mp3',
  'camera_flash': '/sounds/click.mp3',
  'neon_like': '/sounds/click.mp3',
  'coin_flip': '/sounds/entrance/coins.mp3',
  'money_stack': '/sounds/jackpot_reverb.mp3',
  'gold_trophy': '/sounds/goldstar.mp3',
  'spotlight_beam': '/sounds/entrance/magical.mp3',
  'champagne_pop': '/sounds/confetti.mp3',
  'vip_pass': '/sounds/click.mp3',
  'police_light': '/sounds/entrance/police_siren.mp3',
  'crown_spin': '/sounds/crown.mp3',
  'fireworks_shot': '/sounds/rocket.mp3',
  'sports_car_rev': '/sounds/supercar.mp3',
  'vault_crack': '/sounds/metal_spin.mp3',
  'gold_bar_drop': '/sounds/entrance/coins.mp3',
  'helicopter_pass': '/sounds/entrance/engine.mp3',
  'diamond_case': '/sounds/diamond.mp3',
  'executive_desk': '/sounds/click.mp3',
  'city_fireworks_show': '/sounds/entrance/explosion.mp3',
  'throne_rise': '/sounds/entrance/royal_fanfare.mp3',
  'red_carpet_rollout': '/sounds/entrance/fanfare.mp3',
  'court_verdict_slam': '/sounds/metal_spin.mp3',
  'luxury_convoy': '/sounds/suv.mp3',
  'money_rain_deluxe': '/sounds/jackpot_reverb.mp3',
  'troll_crown': '/sounds/crown.mp3',
  'city_takeover': '/sounds/entrance/explosion.mp3',
  'final_verdict': '/sounds/evil_laugh.mp3',
  'godfather_arrival': '/sounds/entrance/elite_command.mp3'
}

const DEFAULT_SOUND = '/sounds/jackpot_reverb.mp3' // Better default than missing file

export default function GiftSoundPlayer({ giftId, volume = 0.5 }: { giftId: string, volume?: number }) {
  useEffect(() => {
    if (!giftId) return

    try {
      const mute = typeof window !== 'undefined' && localStorage.getItem('tc_mute_gift_sounds') === 'true'
      if (mute) return
      
      const soundFile = SOUND_MAP[giftId] || DEFAULT_SOUND
      const audio = new Audio(soundFile)
      audio.volume = volume
      
      audio.play().catch((e) => {
        console.warn('Failed to play gift sound', soundFile, e)
      })
    } catch (e) {
      console.warn('Gift sound playback error', e)
    }
  }, [giftId, volume])

  return null
}
