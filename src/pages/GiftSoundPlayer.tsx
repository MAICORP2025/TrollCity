import { useEffect } from 'react'

const soundMap: Record<string, string> = {
  troll: '/sounds/troll.mp3',
  rose: '/sounds/rose.mp3',
  heart: '/sounds/heart.mp3',
  diamond: '/sounds/diamond.mp3',
  vived: '/sounds/vived.mp3',
  sav: '/sounds/sav.mp3',
  admin_tool: '/sounds/tool.mp3',
  rocket: '/sounds/rocket.mp3',
  confetti: '/sounds/confetti.mp3',
  cupcake: '/sounds/cupcake.mp3',
  sushi: '/sounds/sushi.mp3',
  bouquet: '/sounds/bouquet.mp3',
  gold_star: '/sounds/goldstar.mp3',
  magic_wand: '/sounds/wand.mp3',
  bear: '/sounds/bear.mp3',
  ice_cream: '/sounds/icecream.mp3',
  blunt: '/sounds/blunt.mp3',
  lighter: '/sounds/lighter.mp3',
  savscratch: '/sounds/scratch.mp3',
  car: '/sounds/car.mp3',
  crown: '/sounds/crown.mp3',
}

export default function GiftSoundPlayer({ giftId }: { giftId: string }) {
  useEffect(() => {
    if (!giftId) return
    const sound = soundMap[giftId]
    if (!sound) {
      // no mapped sound — skip silently
      return
    }
    try {
      const audio = new Audio(sound)
      audio.play().catch((e) => {
        console.warn('Failed to play gift sound', sound, e)
      })
    } catch (e) {
      console.warn('Gift sound playback error', e)
    }
  }, [giftId])

  return null
}
