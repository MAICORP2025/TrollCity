// src/lib/levelsConfig.js

export const buyerLevelMeta = {
  1: { name: "Goblin Sprout", color: "bg-gray-700 text-gray-200", icon: "🪙" },
  2: { name: "Mischief Rookie", color: "bg-green-700 text-white", icon: "🌀" },
  3: { name: "Chaos Supporter", color: "bg-purple-700 text-white", icon: "⚡" },
  4: { name: "Troll Champion", color: "bg-indigo-700 text-white", icon: "🏆" },
  5: { name: "Elite Troll Backer", color: "bg-pink-700 text-white", icon: "💎" },
  6: { name: "Titan of Troll City", color: "bg-amber-700 text-white", icon: "🌋" },
  7: { name: "Mythic Benefactor", color: "bg-emerald-700 text-white", icon: "🧿" },
  8: { name: "Divine OverTroll", color: "bg-fuchsia-700 text-white", icon: "👑" },
  9: { name: "Ancient Elder Troll", color: "bg-sky-700 text-white", icon: "🌌" },
  10: { name: "IMMORTAL TROLL KING", color: "bg-red-700 text-yellow-300", icon: "🔥" },
};

export const streamLevelMeta = {
  1: { name: "Rookie Trollcaster", color: "bg-gray-700 text-gray-200", icon: "📻" },
  2: { name: "Banter Beginner", color: "bg-green-700 text-white", icon: "🎙️" },
  3: { name: "Chaos Host", color: "bg-purple-700 text-white", icon: "🎭" },
  4: { name: "Mayhem Broadcaster", color: "bg-indigo-700 text-white", icon: "🎧" },
  5: { name: "Troll Arena Performer", color: "bg-pink-700 text-white", icon: "🎪" },
  6: { name: "Elite Chaos Caster", color: "bg-amber-700 text-white", icon: "🌪️" },
  7: { name: "Troll Master Broadcaster", color: "bg-emerald-700 text-white", icon: "🧌" },
  8: { name: "Mischief Legend", color: "bg-fuchsia-700 text-white", icon: "🌟" },
  9: { name: "Troll Star Icon", color: "bg-sky-700 text-white", icon: "⭐" },
  10: { name: "Troll City MEGASTAR", color: "bg-red-700 text-yellow-300", icon: "🚀" },
};

export const mainLevelMeta = {
  1: { name: "Dusty Baby Troll", color: "bg-gray-600 text-gray-200", icon: "👶" },
  10: { name: "Chaos Hatchling", color: "bg-green-600 text-white", icon: "🥚" },
  25: { name: "Digital Menace", color: "bg-blue-600 text-white", icon: "👾" },
  50: { name: "Carnival Hexcaster", color: "bg-purple-600 text-white", icon: "🎭" },
  100: { name: "TROLL CITY IMMORTAL", color: "bg-red-600 text-yellow-300", icon: "👹" },
  250: { name: "Veteran Warrior", color: "bg-amber-600 text-white", icon: "⚔️" },
  500: { name: "Elite Commander", color: "bg-slate-600 text-white", icon: "🎖️" },
  1000: { name: "Legendary Champion", color: "bg-yellow-600 text-white", icon: "🏆" },
  2000: { name: "Mythic Legend", color: "bg-rose-600 text-white animate-pulse", icon: "🐲" },
};

export function getBuyerMeta(level = 1) {
  if (level > 10) return { ...buyerLevelMeta[10], name: `${buyerLevelMeta[10].name} ${level}` };
  return buyerLevelMeta[level] || buyerLevelMeta[1];
}

export function getStreamMeta(level = 1) {
  if (level > 10) return { ...streamLevelMeta[10], name: `${streamLevelMeta[10].name} ${level}` };
  return streamLevelMeta[level] || streamLevelMeta[1];
}

export function getMainLevelMeta(level = 1) {
  // Find the highest threshold less than or equal to current level
  const thresholds = Object.keys(mainLevelMeta).map(Number).sort((a, b) => b - a);
  const match = thresholds.find(t => level >= t);
  return mainLevelMeta[match] || mainLevelMeta[1];
}