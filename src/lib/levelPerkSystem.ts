import { supabase } from './supabase'
import { getUnlockedPerks, getLevelPerkIds, PERKS } from '../config/levelSystem'

const LEVEL_PERK_EXPIRY_YEARS = 100

function getFarFutureExpiry() {
  const expiry = new Date()
  expiry.setFullYear(expiry.getFullYear() + LEVEL_PERK_EXPIRY_YEARS)
  return expiry.toISOString()
}

export async function grantLevelPerksForUser(userId: string, level: number) {
  if (!userId || typeof level !== 'number' || level < 1) {
    return { granted: [] }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData?.session?.access_token) {
    console.error('No active session - cannot grant level perks')
    return { granted: [] }
  }

  const unlockedPerks = getUnlockedPerks(level)
  if (unlockedPerks.length === 0) {
    return { granted: [] }
  }

  const perkIds = getLevelPerkIds(level)
  const now = new Date().toISOString()
  const expiresAt = getFarFutureExpiry()

  const { data: existingRows, error: existingError } = await supabase
    .from('user_perks')
    .select('id, perk_id')
    .eq('user_id', userId)
    .in('perk_id', perkIds)

  if (existingError) {
    console.error('Error checking existing level perks:', existingError)
    return { granted: [] }
  }

  const existingPerkIds = new Set(existingRows?.map((row) => row.perk_id) || [])

  const toInsert: Array<{ user_id: string; perk_id: string; purchased_at: string; expires_at: string; is_active: boolean; metadata: any }> = []

  unlockedPerks.forEach((perk) => {
    if (existingPerkIds.has(perk.id)) {
      return
    }

    toInsert.push({
      user_id: userId,
      perk_id: perk.id,
      purchased_at: now,
      expires_at: expiresAt,
      is_active: false,
      metadata: {
        source: 'level_unlock',
        perk_name: perk.label,
        perk_description: perk.description,
        perk_tier: perk.tier,
        level_required: perk.levelRequired,
        unlocked_at: now
      }
    })
  })

  const granted: string[] = []

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('user_perks').insert(toInsert)
    if (insertError) {
      console.error('Error inserting level perks:', insertError)
    } else {
      granted.push(...toInsert.map((p) => p.perk_id))
    }
  }

  return { granted }
}

export function getLevelPerksForLevel(level: number) {
  return getUnlockedPerks(level)
}

export function getUpcomingLevelPerks(level: number, window = 3) {
  return PERKS
    .filter((perk) => perk.levelRequired > level && perk.levelRequired <= level + window)
    .sort((a, b) => a.levelRequired - b.levelRequired)
}
