export type LeagueMissionStatus = 'active' | 'completed' | 'claimed' | 'expired'

export interface LeagueMission {
  id: string
  user_id: string
  league_event_id: string | null
  mission_key: string
  title: string
  description: string
  event_type: string
  target_value: number
  current_value: number
  reward_points: number
  reward_xp: number
  reward_coins: number
  status: LeagueMissionStatus
  generated_by: string
  completed_at: string | null
  claimed_at: string | null
  expires_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface UserLeagueProgress {
  level: number
  xpTotal: number
  xpToNext: number
  xpProgress: number
  tier: string
  nextReward: string
  paidChatUnlock: boolean
  paidChatLabel: string
  paidChatDetail: string
  paidChatTargetLevel: number
}

export const getLeagueTier = (level: number) => {
  if (level >= 2000) return 'Troll City Legend League'
  if (level >= 1500) return 'Legendary Citizen League'
  if (level >= 1000) return 'Elite Citizen League'
  if (level >= 700) return 'Verified City League'
  if (level >= 400) return 'City Regular League'
  if (level >= 100) return 'Active Citizen League'
  return 'Rookie Citizen League'
}

export const getXpRequiredForNextLevel = (level: number) => {
  return Math.floor(100 + level * 35 + Math.pow(level, 1.35))
}

export const getXpTotalForLevel = (level: number) => {
  let total = 0
  for (let i = 1; i < level; i += 1) {
    total += getXpRequiredForNextLevel(i)
  }
  return total
}

export const getLevelProgress = (currentXp: number, level: number) => {
  const currentLevelTotal = getXpTotalForLevel(level)
  const nextLevelTotal = currentLevelTotal + getXpRequiredForNextLevel(level)
  const currentLevelXp = Math.max(0, currentXp - currentLevelTotal)
  const remainingXp = Math.max(0, nextLevelTotal - currentXp)
  const progress = nextLevelTotal > currentLevelTotal
    ? Math.min(100, Math.max(0, Math.round((currentLevelXp / (nextLevelTotal - currentLevelTotal)) * 100)))
    : 100

  return {
    currentXp,
    currentLevelXp,
    xpToNext: remainingXp,
    progress,
  }
}

export const getNextReward = (level: number) => {
  if (level >= 2000) return 'Legendary Legacy Badge + 10,000 Trollmonds'
  if (level >= 1500) return 'Legendary City Supply Drop + 7,500 Trollmonds'
  if (level >= 1000) return 'Elite Pulse Reward + 5,000 Trollmonds'
  if (level >= 700) return 'Verified City Package + 3,000 Trollmonds'
  if (level >= 400) return 'Regular League Loot + 2,000 Trollmonds'
  if (level >= 100) return 'Active Citizen Chest + 1,000 Trollmonds'
  return 'Rookie Bonus Pack + 500 Trollmonds'
}

export const getPaidChatUnlockStatus = (level: number) => {
  if (level >= 420) {
    return {
      unlocked: true,
      label: 'Paid Chats Unlocked',
      detail: 'You can now earn from paid chats.',
      targetLevel: 420,
    }
  }

  return {
    unlocked: false,
    label: 'Paid Chats unlock at Level 420',
    detail: `Reach Level 420 to unlock paid chat earning and bonus status.`,
    targetLevel: 420,
  }
}

export const buildUserLeagueProgress = (stats?: any, profile?: any): UserLeagueProgress => {
  const level = Number(stats?.level ?? profile?.level ?? 1)
  const xpTotal = Number(stats?.xp_total ?? profile?.xp ?? 0)
  const xpToNext = Number(stats?.xp_to_next_level ?? getXpRequiredForNextLevel(level))
  const progress = Number(stats?.xp_progress ?? getLevelProgress(xpTotal, level).progress)
  const tier = getLeagueTier(level)
  const nextReward = getNextReward(level)
  const paidChat = getPaidChatUnlockStatus(level)

  return {
    level,
    xpTotal,
    xpToNext,
    xpProgress: Math.min(100, Math.max(0, progress)),
    tier,
    nextReward,
    paidChatUnlock: paidChat.unlocked,
    paidChatLabel: paidChat.label,
    paidChatDetail: paidChat.detail,
    paidChatTargetLevel: paidChat.targetLevel,
  }
}

export const formatLeagueEventType = (type?: string | null) => {
  if (!type) return 'Live League'
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

export const formatMissionProgress = (mission: LeagueMission) => {
  const progress = mission.target_value > 0
    ? Math.min(100, Math.round((mission.current_value / mission.target_value) * 100))
    : 0

  return {
    label: `${mission.current_value}/${mission.target_value}`,
    percent: progress,
  }
}

export const getMissionTone = (status: LeagueMissionStatus) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/20'
    case 'claimed':
      return 'bg-slate-700/60 text-slate-200'
    case 'expired':
      return 'bg-rose-500/15 text-rose-200'
    default:
      return 'bg-cyan-500/10 text-cyan-200'
  }
}
