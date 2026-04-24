export interface BadgeCatalogRow {
  id: string
  slug: string
  name: string
  description: string
  category: string
  icon_url?: string | null
  rarity: string
  sort_order: number
  is_active: boolean
}

export interface UserBadgeRow {
  badge_id: string
  earned_at: string
}

export interface MergedBadge extends BadgeCatalogRow {
  earned: boolean
  earned_at?: string
}

export function mergeBadges(catalog: BadgeCatalogRow[], userBadges: UserBadgeRow[]): MergedBadge[] {
  const earnedMap = new Map<string, string>()
  userBadges.forEach((b) => earnedMap.set(b.badge_id, b.earned_at))

  return (catalog || [])
    .map((b) => ({
      ...b,
      earned: earnedMap.has(b.id),
      earned_at: earnedMap.get(b.id),
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
}
