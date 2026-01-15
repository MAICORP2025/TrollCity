export type PerkCategory = 'visibility' | 'chat' | 'protection' | 'boost' | 'cosmetic' | 'utility'

export interface PerkSummary {
  id: string
  name: string
  category: PerkCategory
  action: string
  source: 'perk_config' | 'coin_store_sample'
}

export const PERKS_SUMMARY: PerkSummary[] = [
  {
    id: 'perk_disappear_chat',
    name: 'Disappearing Chats',
    category: 'visibility',
    action: 'Chat messages from this user auto-hide after a short delay.',
    source: 'perk_config',
  },
  {
    id: 'perk_ghost_mode',
    name: 'Ghost Mode',
    category: 'visibility',
    action: 'Hide this user from viewer lists and online status indicators.',
    source: 'perk_config',
  },
  {
    id: 'perk_message_admin',
    name: 'Message Admin',
    category: 'chat',
    action: 'Unlocks the ability to DM the Admin account directly.',
    source: 'perk_config',
  },
  {
    id: 'perk_global_highlight',
    name: 'Glowing Username',
    category: 'cosmetic',
    action: 'Adds a neon glow effect to the username across chats and gifts.',
    source: 'perk_config',
  },
  {
    id: 'perk_rgb_username',
    name: 'RGB Username',
    category: 'cosmetic',
    action: 'Applies an animated rainbow glow style to the username globally.',
    source: 'perk_config',
  },
  {
    id: 'perk_slowmo_chat',
    name: 'Slow-Motion Chat Control',
    category: 'chat',
    action: 'Grants the ability to toggle slow-mode in live streams.',
    source: 'perk_config',
  },
  {
    id: 'perk_troll_alarm',
    name: 'Troll Alarm Arrival',
    category: 'cosmetic',
    action: 'Plays an arrival sound and flash effect when the user joins.',
    source: 'perk_config',
  },
  {
    id: 'perk_ban_shield',
    name: 'Ban Shield',
    category: 'protection',
    action: 'Blocks moderation actions like kick, mute, or ban while active.',
    source: 'perk_config',
  },
  {
    id: 'perk_double_xp',
    name: 'Double XP Mode',
    category: 'boost',
    action: 'Doubles XP gains from eligible actions while the perk is active.',
    source: 'perk_config',
  },
  {
    id: 'perk_flex_banner',
    name: 'Golden Flex Banner',
    category: 'cosmetic',
    action: 'Shows a golden crown banner on the user’s messages.',
    source: 'perk_config',
  },
  {
    id: 'perk_troll_spell',
    name: 'Troll Spell',
    category: 'cosmetic',
    action: 'Allows temporarily changing another user’s username style and emoji.',
    source: 'perk_config',
  },
  {
    id: 'perk_rgb_username',
    name: 'RGB Username (Sample)',
    category: 'cosmetic',
    action: 'Sample catalog entry for rainbow username effect in the coin store.',
    source: 'coin_store_sample',
  },
  {
    id: 'perk_chat_shine',
    name: 'Chat Shine',
    category: 'visibility',
    action: 'Adds a glowing or highlighted style to this user’s chat messages.',
    source: 'coin_store_sample',
  },
  {
    id: 'perk_stream_boost_lite',
    name: 'Stream Boost Lite',
    category: 'boost',
    action: 'Applies a small discovery and visibility boost to the user’s stream.',
    source: 'coin_store_sample',
  },
  {
    id: 'perk_coin_magnet',
    name: 'Coin Magnet',
    category: 'boost',
    action: 'Increases coin rewards earned from eligible activities by a small percentage.',
    source: 'coin_store_sample',
  },
  {
    id: 'perk_troll_shield',
    name: 'Troll Shield',
    category: 'protection',
    action: 'Reduces fines or penalties from TrollCourt style actions by a small amount.',
    source: 'coin_store_sample',
  },
  {
    id: 'perk_priority_tag',
    name: 'Priority Tag',
    category: 'cosmetic',
    action: 'Displays the user’s name above chat or with priority styling.',
    source: 'coin_store_sample',
  },
  {
    id: 'perk_faster_cooldowns',
    name: 'Faster Cooldowns',
    category: 'boost',
    action: 'Reduces cooldown timers for eligible actions such as gifts or perks.',
    source: 'coin_store_sample',
  },
]

export type ProtectionType = 'bankrupt' | 'kick' | 'full' | 'gambling' | 'dispute' | 'supreme'

export interface InsuranceSummary {
  id: string
  name: string
  protectionType: ProtectionType
  action: string
}

export const INSURANCE_SUMMARY: InsuranceSummary[] = [
  {
    id: 'insurance_bankrupt_24h',
    name: 'Bankrupt Insurance (24h)',
    protectionType: 'bankrupt',
    action: 'Blocks wheel bankrupt penalties for a 24 hour period.',
  },
  {
    id: 'insurance_kick_24h',
    name: 'Kick Insurance (24h)',
    protectionType: 'kick',
    action: 'Blocks kick penalties from streams for a 24 hour period.',
  },
  {
    id: 'insurance_full_24h',
    name: 'Full Protection (24h)',
    protectionType: 'full',
    action: 'Covers both bankrupt and kick style penalties for 24 hours.',
  },
  {
    id: 'insurance_bankrupt_week',
    name: 'Bankrupt Insurance (1 Week)',
    protectionType: 'bankrupt',
    action: 'Blocks wheel bankrupt penalties for seven days.',
  },
  {
    id: 'insurance_full_week',
    name: 'Full Protection (1 Week)',
    protectionType: 'full',
    action: 'Covers both bankrupt and kick style penalties for seven days.',
  },
  {
    id: 'insurance_basic_week',
    name: 'Basic Coverage',
    protectionType: 'gambling',
    action: 'Reduces gambling losses by around ten percent for weekly coverage.',
  },
  {
    id: 'insurance_basic_month',
    name: 'Basic Monthly',
    protectionType: 'gambling',
    action: 'Reduces gambling losses by around ten percent for monthly coverage.',
  },
  {
    id: 'insurance_vip_week',
    name: 'VIP Coverage',
    protectionType: 'kick',
    action: 'Reduces losses and blocks a limited number of penalties each week.',
  },
  {
    id: 'insurance_vip_month',
    name: 'VIP Monthly',
    protectionType: 'kick',
    action: 'Reduces losses and blocks several penalties over a month.',
  },
  {
    id: 'insurance_elite_week',
    name: 'Elite Coverage',
    protectionType: 'dispute',
    action: 'Provides stronger loss reduction and dispute assistance for a week.',
  },
  {
    id: 'insurance_elite_month',
    name: 'Elite Monthly',
    protectionType: 'dispute',
    action: 'Provides stronger loss reduction and dispute help for a month.',
  },
  {
    id: 'insurance_supreme_week',
    name: 'Supreme Court Shield',
    protectionType: 'supreme',
    action: 'High tier loss reduction with broad dispute and penalty shielding.',
  },
  {
    id: 'insurance_supreme_month',
    name: 'Supreme Monthly Shield',
    protectionType: 'supreme',
    action: 'Extended high tier protection with many penalty blocks each month.',
  },
]

export type CallPackageType = 'audio' | 'video'

export interface CallPackageSummary {
  id: string
  name: string
  type: CallPackageType
  minutes: number
  coins: number
  action: string
}

export const CALL_PACKAGES_SUMMARY: CallPackageSummary[] = [
  {
    id: 'audio_60',
    name: 'Base Audio',
    type: 'audio',
    minutes: 60,
    coins: 1000,
    action: 'Adds sixty audio call minutes via the call minutes balance.',
  },
  {
    id: 'audio_150',
    name: 'Standard Audio',
    type: 'audio',
    minutes: 150,
    coins: 2000,
    action: 'Adds one hundred fifty audio minutes to the user call balance.',
  },
  {
    id: 'audio_400',
    name: 'Premium Audio',
    type: 'audio',
    minutes: 400,
    coins: 5000,
    action: 'Adds four hundred audio minutes for long running audio calls.',
  },
  {
    id: 'audio_1000',
    name: 'Ultra Audio',
    type: 'audio',
    minutes: 1000,
    coins: 10000,
    action: 'Adds one thousand audio minutes for heavy audio callers.',
  },
  {
    id: 'video_30',
    name: 'Base Video',
    type: 'video',
    minutes: 30,
    coins: 1000,
    action: 'Adds thirty video call minutes via the call minutes balance.',
  },
  {
    id: 'video_75',
    name: 'Standard Video',
    type: 'video',
    minutes: 75,
    coins: 2000,
    action: 'Adds seventy five video minutes for casual video calls.',
  },
  {
    id: 'video_200',
    name: 'Premium Video',
    type: 'video',
    minutes: 200,
    coins: 5000,
    action: 'Adds two hundred video minutes for extended video sessions.',
  },
  {
    id: 'video_500',
    name: 'Ultra Video',
    type: 'video',
    minutes: 500,
    coins: 10000,
    action: 'Adds five hundred video minutes for intensive callers.',
  },
]

export interface BroadcastThemeSummary {
  id: string
  name: string
  action: string
  animationMode: 'static' | 'image' | 'video' | 'reactive'
  source: 'supabase_broadcast_background_themes'
}

export const BROADCAST_THEMES_SUMMARY: BroadcastThemeSummary[] = [
  {
    id: 'dynamic_catalog',
    name: 'Broadcast Background Theme',
    action:
      'Applies a themed background to the broadcast using image, video, or reactive visuals stored in the broadcast_background_themes table.',
    animationMode: 'reactive',
    source: 'supabase_broadcast_background_themes',
  },
]

