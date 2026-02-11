import assert from 'node:assert'
import { mergeBadges } from './mergeBadges.ts'

const catalog = [
  { id: 'a', slug: 'first', name: 'First', description: '', category: 'x', icon_url: null, rarity: 'common', sort_order: 2, is_active: true },
  { id: 'b', slug: 'second', name: 'Second', description: '', category: 'x', icon_url: null, rarity: 'common', sort_order: 1, is_active: true },
]

const earned = [{ badge_id: 'a', earned_at: '2026-01-21T00:00:00Z' }]

const merged = mergeBadges(catalog, earned)

assert.equal(merged.length, 2)
assert.equal(merged[0].slug, 'second', 'sort_order respected')
assert.equal(merged[1].earned, true, 'earned flag set')
assert.equal(merged[1].earned_at, '2026-01-21T00:00:00Z', 'earned_at carried through')
assert.equal(merged[0].earned, false, 'unearned badges stay false')

console.log('mergeBadges tests passed')
