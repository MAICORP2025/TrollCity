import { useEffect, useState, useCallback } from 'react'
import { getLevelProfile } from '../progressionEngine'

export interface XPData {
  level: number
  xp: number
  total_xp: number
  next_level_xp: number
  buyer_xp?: number
  buyer_level?: number
  stream_xp?: number
  stream_level?: number
}

/**
 * Unified XP sync hook for all pages
 * Ensures consistent XP display across the entire app
 */
export function useXPSync(userId?: string) {
  const [xpData, setXPData] = useState<XPData | null>(null)
  const [loading, setLoading] = useState(true)

  const syncXP = useCallback(async (id: string) => {
    if (!id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const data = await getLevelProfile(id)
      setXPData(data)
    } catch (error) {
      console.error('Error syncing XP:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userId) {
      syncXP(userId)
    }
  }, [userId, syncXP])

  return { xpData, loading, syncXP }
}
