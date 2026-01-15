import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../store'

export type AvatarSkinTone = 'light' | 'medium' | 'dark'
export type AvatarHairStyle = 'short' | 'long' | 'buzz' | 'none'
export type AvatarHairColor = 'black' | 'brown' | 'blonde' | 'red' | 'neon'
export type AvatarOutfit = 'casual' | 'formal' | 'street'
export type AvatarAccessory = 'none' | 'glasses' | 'hat' | 'mask'

export interface AvatarConfig {
  skinTone: AvatarSkinTone
  hairStyle: AvatarHairStyle
  hairColor: AvatarHairColor
  outfit: AvatarOutfit
  accessory: AvatarAccessory
  useAsProfilePicture: boolean
}

const defaultConfig: AvatarConfig = {
  skinTone: 'medium',
  hairStyle: 'short',
  hairColor: 'brown',
  outfit: 'casual',
  accessory: 'none',
  useAsProfilePicture: false
}

export function useAvatar() {
  const { user } = useAuthStore()
  const [config, setConfigState] = useState<AvatarConfig>(defaultConfig)
  const userKey = user?.id ? `trollcity_avatar_${user.id}` : null

  useEffect(() => {
    if (!userKey) {
      setConfigState(defaultConfig)
      return
    }
    try {
      const raw = localStorage.getItem(userKey)
      if (!raw) {
        setConfigState(defaultConfig)
        return
      }
      const parsed = JSON.parse(raw)
      setConfigState({
        ...defaultConfig,
        ...parsed
      })
    } catch {
      setConfigState(defaultConfig)
    }
  }, [userKey])

  const setConfig = useCallback(
    (updater: AvatarConfig | ((prev: AvatarConfig) => AvatarConfig)) => {
      setConfigState(prev => {
        const next = typeof updater === 'function' ? (updater as (p: AvatarConfig) => AvatarConfig)(prev) : updater
        if (userKey) {
          try {
            localStorage.setItem(userKey, JSON.stringify(next))
          } catch {
          }
        }
        return next
      })
    },
    [userKey]
  )

  return { config, setConfig }
}

