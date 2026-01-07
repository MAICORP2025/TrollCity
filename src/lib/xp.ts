import { supabase } from './supabase'

// Level Thresholds
export const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 500 },
  { level: 3, xp: 1500 },
  { level: 4, xp: 3000 },
  { level: 5, xp: 5000 },
  { level: 6, xp: 8000 },
  { level: 7, xp: 12000 },
  { level: 8, xp: 17000 },
  { level: 9, xp: 23000 },
  { level: 10, xp: 30000 },
  { level: 15, xp: 70000 },
  { level: 20, xp: 150000 },
  { level: 25, xp: 250000 },
  { level: 30, xp: 400000 },
]

export const BADGE_TYPES = {
  GIFTER: 'gifter',
  STREAMER: 'streamer',
  FAMILY_WAR: 'family_war',
  MILLIONAIRE: 'millionaire',
  TOP_GIFTER: 'top_gifter_daily'
}

export const XP_RATES = {
  GIFTER: 10, // coins / 10
  STREAMER: 12, // coins / 12
  WAR: 5 // war_points / 5
}

/**
 * Calculate level based on XP
 */
export function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].xp) {
      // Interpolate for levels between explicit thresholds if needed
      // But the requirement says "use these", implying step function or interpolation?
      // "Level 1: 0, Level 2: 500". If I have 600, I am Level 2.
      // What about level 11? The table jumps from 10 to 15.
      // I will assume standard interpolation for missing levels or just stick to the highest bracket passed.
      // However, usually levels are continuous.
      // Let's assume linear interpolation or just filling in the gaps is expected, 
      // but for now I'll use the provided table as "milestones".
      // Actually, standard gaming logic: if you are between 10 (30k) and 15 (70k), you are level 10, 11, 12...
      // I'll assume a linear progression or just return the highest threshold passed.
      // Let's refine: The prompt gives specific thresholds. I should probably treat them as the floor for that level.
      // For gaps like 10->15, I'll calculate intermediate levels if necessary, but the prompt is specific.
      // I will stick to the highest level in the list that is <= current XP.
      return LEVEL_THRESHOLDS[i].level
    }
  }
  return 1
}

/**
 * Get next level details
 */
export function getNextLevel(currentXp: number) {
  const currentLevel = calculateLevel(currentXp)
  // Find next threshold
  const nextThreshold = LEVEL_THRESHOLDS.find(t => t.xp > currentXp)
  
  if (!nextThreshold) return null // Max level reached based on table

  return {
    level: nextThreshold.level,
    xpRequired: nextThreshold.xp,
    xpRemaining: nextThreshold.xp - currentXp,
    progress: ((currentXp - (LEVEL_THRESHOLDS.find(t => t.level === currentLevel)?.xp || 0)) / (nextThreshold.xp - (LEVEL_THRESHOLDS.find(t => t.level === currentLevel)?.xp || 0))) * 100
  }
}

/**
 * Update User XP and handle level ups
 */
export async function updateUserXp(userId: string, type: 'gifter' | 'streamer', xpAmount: number) {
  try {
    // 1. Get current user profile
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, xp, level')
      .eq('id', userId)
      .maybeSingle()

    if (fetchError) {
      console.error('Error fetching user profile for XP update:', fetchError)
      return
    }

    if (!profile) {
      console.warn('User profile not found for XP update:', userId)
      return
    }

    const currentXp = profile.xp || 0
    const currentLevel = profile.level || 1
    const newXp = currentXp + xpAmount
    const newLevel = calculateLevel(newXp)

    // 2. Update user profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        xp: newXp,
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating user XP:', updateError)
      return
    }

    // 3. Check for level up
    if (newLevel > currentLevel) {
      // Award Badge
      const badgeType = type === 'gifter' ? BADGE_TYPES.GIFTER : BADGE_TYPES.STREAMER
      await grantBadge(userId, badgeType, newLevel)

      // Notify User (if this is client-side or we have a notification system)
      // Since this might run in a background context or triggered by another user (sender triggering receiver),
      // we can't always toast. But if it's the current user, we can.
      // We'll return the info so the caller can decide.
      return { leveledUp: true, newLevel, type }
    }

    return { leveledUp: false, newLevel, type }

  } catch (err) {
    console.error('updateUserXp exception:', err)
  }
}

/**
 * Grant a badge to a user
 */
export async function grantBadge(userId: string, type: string, level: number) {
  try {
    // Check if badge already exists (optional, but good practice)
    // Assuming a 'user_badges' table
    const { error } = await supabase
      .from('user_badges')
      .insert({
        user_id: userId,
        badge_type: type,
        level: level,
        awarded_at: new Date().toISOString()
      })
    
    if (error) {
      // Ignore duplicate key errors if unique constraint exists
      if (error.code !== '23505') { 
        console.error('Error granting badge:', error)
      }
    }
  } catch (err) {
    console.error('grantBadge exception:', err)
  }
}

/**
 * Process Gift XP Logic (Caller function)
 */
export async function processGiftXp(senderId: string, receiverId: string, coinAmount: number) {
  // 1. Calculate XP
  const gifterXp = Math.floor(coinAmount / XP_RATES.GIFTER)
  const streamerXp = Math.floor(coinAmount / XP_RATES.STREAMER)

  // 2. Update Sender (Gifter)
  const senderResult = await updateUserXp(senderId, 'gifter', gifterXp)

  // 3. Update Receiver (Streamer)
  const receiverResult = await updateUserXp(receiverId, 'streamer', streamerXp)

  // 4. Check for Millionaire Hall of Fame
  if (coinAmount >= 250000) {
    await addToMillionaireHallOfFame(senderId, receiverId, coinAmount)
  }

  return { senderResult, receiverResult }
}

/**
 * Add to Millionaire Hall of Fame
 */
async function addToMillionaireHallOfFame(senderId: string, receiverId: string, amount: number) {
  try {
    // Assuming 'hall_of_fame' table
    await supabase
      .from('hall_of_fame')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        amount: amount,
        created_at: new Date().toISOString()
      })
    
    // Also grant millionaire badge
    await grantBadge(senderId, BADGE_TYPES.MILLIONAIRE, 1) // Level 1 millionaire?
  } catch (err) {
    console.error('addToMillionaireHallOfFame error:', err)
  }
}
