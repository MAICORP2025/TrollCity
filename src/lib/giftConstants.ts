export interface GiftItem {
  id: string;
  name: string;
  cost: number;
  tier: 'I' | 'II' | 'III' | 'IV' | 'V';
  icon: string;
  duration: number; // seconds
}

export const OFFICIAL_GIFTS: GiftItem[] = [
  // TIER I - 100 Coins (3s)
  { id: 'cash_toss', name: 'Cash Toss', cost: 100, tier: 'I', icon: '💸', duration: 3 },
  { id: 'heart_pulse', name: 'Heart Pulse', cost: 100, tier: 'I', icon: '💓', duration: 3 },
  { id: 'fire_burst', name: 'Fire Burst', cost: 100, tier: 'I', icon: '🔥', duration: 3 },
  { id: 'applause', name: 'Applause', cost: 100, tier: 'I', icon: '👏', duration: 3 },
  { id: 'camera_flash', name: 'Camera Flash', cost: 100, tier: 'I', icon: '📸', duration: 3 },
  { id: 'neon_like', name: 'Neon Like', cost: 100, tier: 'I', icon: '👍', duration: 3 },
  { id: 'coin_flip', name: 'Coin Flip', cost: 100, tier: 'I', icon: '🪙', duration: 3 },
  { id: 'whistle_blow', name: 'Whistle Blow', cost: 100, tier: 'I', icon: '😙', duration: 3 },

  // TIER II - 500 Coins (3s)
  { id: 'money_stack', name: 'Money Stack', cost: 500, tier: 'II', icon: '💵', duration: 3 },
  { id: 'gold_trophy', name: 'Gold Trophy', cost: 500, tier: 'II', icon: '🏆', duration: 3 },
  { id: 'spotlight_beam', name: 'Spotlight Beam', cost: 500, tier: 'II', icon: '🔦', duration: 3 },
  { id: 'champagne_pop', name: 'Champagne Pop', cost: 500, tier: 'II', icon: '🍾', duration: 3 },
  { id: 'vip_pass', name: 'VIP Pass', cost: 500, tier: 'II', icon: '🎫', duration: 3 },
  { id: 'police_light', name: 'Police Light', cost: 500, tier: 'II', icon: '🚨', duration: 3 },
  { id: 'crown_spin', name: 'Crown Spin', cost: 500, tier: 'II', icon: '👑', duration: 3 },
  { id: 'fireworks_shot', name: 'Fireworks Shot', cost: 500, tier: 'II', icon: '🎆', duration: 3 },

  // TIER III - 2,500 Coins (3s)
  { id: 'sports_car_rev', name: 'Sports Car Rev', cost: 2500, tier: 'III', icon: '🏎️', duration: 3 },
  { id: 'vault_crack', name: 'Vault Crack', cost: 2500, tier: 'III', icon: '🔓', duration: 3 },
  { id: 'gold_bar_drop', name: 'Gold Bar Drop', cost: 2500, tier: 'III', icon: '🧈', duration: 3 },
  { id: 'helicopter_pass', name: 'Helicopter Pass', cost: 2500, tier: 'III', icon: '🚁', duration: 3 },
  { id: 'diamond_case', name: 'Diamond Case', cost: 2500, tier: 'III', icon: '💎', duration: 3 },
  { id: 'executive_desk', name: 'Executive Desk', cost: 2500, tier: 'III', icon: '💼', duration: 3 },

  // TIER IV - 10,000 Coins (15s)
  { id: 'city_fireworks', name: 'City Fireworks Show', cost: 10000, tier: 'IV', icon: '🎇', duration: 15 },
  { id: 'throne_rise', name: 'Throne Rise', cost: 10000, tier: 'IV', icon: '🪑', duration: 15 },
  { id: 'red_carpet', name: 'Red Carpet Rollout', cost: 10000, tier: 'IV', icon: '🧣', duration: 15 },
  { id: 'court_verdict', name: 'Court Verdict Slam', cost: 10000, tier: 'IV', icon: '⚖️', duration: 15 },
  { id: 'luxury_convoy', name: 'Luxury Convoy', cost: 10000, tier: 'IV', icon: '🚙', duration: 15 },
  { id: 'money_rain_deluxe', name: 'Money Rain Deluxe', cost: 10000, tier: 'IV', icon: '🤑', duration: 15 },

  // TIER V - Legendary (15s)
  { id: 'troll_crown', name: 'Troll Crown', cost: 50000, tier: 'V', icon: '👸', duration: 15 },
  { id: 'city_takeover', name: 'City Takeover', cost: 100000, tier: 'V', icon: '🏙️', duration: 15 },
  { id: 'final_verdict', name: 'Final Verdict', cost: 500000, tier: 'V', icon: '👨‍⚖️', duration: 15 },
  { id: 'godfather_arrival', name: 'Godfather Arrival', cost: 1000000, tier: 'V', icon: '🤵', duration: 15 },
];
