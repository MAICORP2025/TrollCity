/**
 * Gift Video Map
 * Maps each gift name/slug to its MP4 video file and sound file
 * Videos go in /public/gift-videos/{id}.webm
 * Sounds already exist in /public/sounds/
 */

export interface GiftVideoEntry {
  id: string;
  keywords: string[];
  video: string;       // path to WebM in /public/gift-videos/
  sound: string;       // path to MP3 in /public/sounds/
  fallbackSound: string;
}

// Each entry: gift ID, keywords to match, video path, sound path
export const GIFT_VIDEO_MAP: GiftVideoEntry[] = [
  { id: 'rose', keywords: ['rose', 'roses', '🌹'], video: '/gift-videos/rose.webm', sound: '/sounds/rose.mp3', fallbackSound: '/sounds/bouquet.mp3' },
  { id: 'flower', keywords: ['flower', 'bouquet', '🌸', '🌺', '🌻', '🌷'], video: '/gift-videos/flower.webm', sound: '/sounds/bouquet.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'heart', keywords: ['heart', 'love', 'pulse', '❤', '💖', '💕'], video: '/gift-videos/heart.webm', sound: '/sounds/heart.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'crown', keywords: ['crown', 'king', 'queen', '👑', 'royal'], video: '/gift-videos/crown.webm', sound: '/sounds/crown.mp3', fallbackSound: '/sounds/golden-buzzer.mp3' },
  { id: 'diamond', keywords: ['diamond', '💎', 'bling'], video: '/gift-videos/diamond.webm', sound: '/sounds/diamond.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'gem', keywords: ['gem', '💍', 'jewel', 'ruby', 'emerald'], video: '/gift-videos/gem.webm', sound: '/sounds/diamond.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'fire', keywords: ['fire', 'flame', 'blaze', '🔥', 'torch'], video: '/gift-videos/fire.webm', sound: '/sounds/lighter.mp3', fallbackSound: '/sounds/entrance/flame.mp3' },
  { id: 'car', keywords: ['car', 'auto', 'drift', '🏎', 'supercar'], video: '/gift-videos/car.webm', sound: '/sounds/car.mp3', fallbackSound: '/sounds/supercar.mp3' },
  { id: 'rocket', keywords: ['rocket', 'launch', '🚀', 'space'], video: '/gift-videos/rocket.webm', sound: '/sounds/rocket.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'money', keywords: ['money', 'cash', 'dollar', '💵', '💸', 'rich'], video: '/gift-videos/money.webm', sound: '/sounds/entrance/coins.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'coin', keywords: ['coin', 'flip', '🪙'], video: '/gift-videos/coin.webm', sound: '/sounds/metal_spin.mp3', fallbackSound: '/sounds/entrance/coins.mp3' },
  { id: 'champagne', keywords: ['champagne', 'bubbly', '🍾', 'toast'], video: '/gift-videos/champagne.webm', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'pizza', keywords: ['pizza', '🍕'], video: '/gift-videos/pizza.webm', sound: '/sounds/sushi.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'coffee', keywords: ['coffee', '☕', 'espresso', 'tea'], video: '/gift-videos/coffee.webm', sound: '/sounds/cupcake.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'beer', keywords: ['beer', '🍺', 'brew', 'pint'], video: '/gift-videos/beer.webm', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'wine', keywords: ['wine', '🍷', 'red wine'], video: '/gift-videos/wine.webm', sound: '/sounds/bouquet.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'ice-cream', keywords: ['ice cream', 'icecream', '🍦', 'gelato'], video: '/gift-videos/ice-cream.webm', sound: '/sounds/icecream.mp3', fallbackSound: '/sounds/cupcake.mp3' },
  { id: 'cake', keywords: ['cake', '🎂', 'cupcake', 'birthday'], video: '/gift-videos/cake.webm', sound: '/sounds/cupcake.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'bomb', keywords: ['bomb', 'explode', '💣', 'tnt', 'dynamite'], video: '/gift-videos/bomb.webm', sound: '/sounds/entrance/explosion.mp3', fallbackSound: '/sounds/lighter.mp3' },
  { id: 'trophy', keywords: ['trophy', 'award', '🏆', 'champion'], video: '/gift-videos/trophy.webm', sound: '/sounds/golden-buzzer.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'star', keywords: ['star', '⭐', 'shooting star', '🌟'], video: '/gift-videos/star.webm', sound: '/sounds/goldstar.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'skull', keywords: ['skull', '💀', 'death', 'dead'], video: '/gift-videos/skull.webm', sound: '/sounds/evil_laugh.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'dragon', keywords: ['dragon', '🐉'], video: '/gift-videos/dragon.webm', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'police', keywords: ['police', 'siren', '🚨', 'cop'], video: '/gift-videos/police.webm', sound: '/sounds/entrance/police_siren.mp3', fallbackSound: '/sounds/entrance/police.mp3' },
  { id: 'music', keywords: ['music', '🎵', 'mic', '🎤', '🎶', 'song'], video: '/gift-videos/music.webm', sound: '/sounds/scratch.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'camera', keywords: ['camera', '📸', 'flash', 'photo'], video: '/gift-videos/camera.webm', sound: '/sounds/click.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'rainbow', keywords: ['rainbow', '🌈'], video: '/gift-videos/rainbow.webm', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'snow', keywords: ['snow', '❄', 'ice', 'frost', 'winter'], video: '/gift-videos/snow.webm', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'ocean', keywords: ['ocean', 'wave', '🌊', 'tsunami', 'sea'], video: '/gift-videos/ocean.webm', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'tornado', keywords: ['tornado', '🌪', 'storm', 'cyclone'], video: '/gift-videos/tornado.webm', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'volcano', keywords: ['volcano', '🌋', 'lava', 'eruption'], video: '/gift-videos/volcano.webm', sound: '/sounds/entrance/explosion.mp3', fallbackSound: '/sounds/lighter.mp3' },
  { id: 'ghost', keywords: ['ghost', '👻', 'haunt', 'spook'], video: '/gift-videos/ghost.webm', sound: '/sounds/entrance/curtain-open.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'balloon', keywords: ['balloon', '🎈', 'party'], video: '/gift-videos/balloon.webm', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'gift-box', keywords: ['gift', 'present', '🎁', 'box', 'mystery'], video: '/gift-videos/gift-box.webm', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'ring', keywords: ['ring', '💍', 'wedding', 'engagement'], video: '/gift-videos/ring.webm', sound: '/sounds/diamond.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'like', keywords: ['like', '👍', 'thumb', 'neon like'], video: '/gift-videos/like.webm', sound: '/sounds/click.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'clap', keywords: ['clap', 'applause', '👏', 'hands'], video: '/gift-videos/clap.webm', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'hammer', keywords: ['hammer', '🔨', 'smash'], video: '/gift-videos/hammer.webm', sound: '/sounds/tool.mp3', fallbackSound: '/sounds/entrance/explosion.mp3' },
  { id: 'sword', keywords: ['sword', '🗡', '⚔', 'blade', 'katana'], video: '/gift-videos/sword.webm', sound: '/sounds/scratch.mp3', fallbackSound: '/sounds/tool.mp3' },
  { id: 'house', keywords: ['house', '🏠', 'mansion', 'villa'], video: '/gift-videos/house.webm', sound: '/sounds/confetti.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'castle', keywords: ['castle', '🏰', 'palace', 'fortress'], video: '/gift-videos/castle.webm', sound: '/sounds/entrance/royal_fanfare.mp3', fallbackSound: '/sounds/crown.mp3' },
  { id: 'helicopter', keywords: ['helicopter', '🚁', 'chopper'], video: '/gift-videos/helicopter.webm', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'plane', keywords: ['plane', '✈', 'airplane', 'jet'], video: '/gift-videos/plane.webm', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'motorcycle', keywords: ['motorcycle', 'bike', '🏍'], video: '/gift-videos/motorcycle.webm', sound: '/sounds/motorcycle.mp3', fallbackSound: '/sounds/supercar.mp3' },
  { id: 'truck', keywords: ['truck', '🚛', 'lorry'], video: '/gift-videos/truck.webm', sound: '/sounds/truck.mp3', fallbackSound: '/sounds/suv.mp3' },
  { id: 'boat', keywords: ['boat', 'ship', '⛵', 'yacht'], video: '/gift-videos/boat.webm', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'train', keywords: ['train', '🚂', 'locomotive'], video: '/gift-videos/train.webm', sound: '/sounds/entrance/engine.mp3', fallbackSound: '/sounds/truck.mp3' },
  { id: 'bear', keywords: ['bear', '🧸', 'teddy'], video: '/gift-videos/bear.webm', sound: '/sounds/bear.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'blunt', keywords: ['blunt', 'cigarette', 'smoke', 'vape', '🚬', 'weed'], video: '/gift-videos/blunt.webm', sound: '/sounds/blunt.mp3', fallbackSound: '/sounds/lighter.mp3' },
  { id: 'sushi', keywords: ['sushi', 'food', '🍣', 'meal'], video: '/gift-videos/sushi.webm', sound: '/sounds/sushi.mp3', fallbackSound: '/sounds/cupcake.mp3' },
  { id: 'laugh', keywords: ['laugh', '😂', 'haha', 'funny', 'lol'], video: '/gift-videos/laugh.webm', sound: '/sounds/evil_laugh.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'cry', keywords: ['cry', '😢', 'tear', 'sad', '😭'], video: '/gift-videos/cry.webm', sound: '/sounds/click.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'angry', keywords: ['angry', '😤', 'rage', 'mad', '😡'], video: '/gift-videos/angry.webm', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'cool', keywords: ['cool', '😎', 'sunglasses', 'swag'], video: '/gift-videos/cool.webm', sound: '/sounds/click.mp3', fallbackSound: '/sounds/goldstar.mp3' },
  { id: 'spark', keywords: ['spark', '⚡', 'electric', 'zap', 'lightning'], video: '/gift-videos/spark.webm', sound: '/sounds/entrance/lightning.mp3', fallbackSound: '/sounds/click.mp3' },
  { id: 'slot', keywords: ['slot', '🎰', 'jackpot', 'casino'], video: '/gift-videos/slot.webm', sound: '/sounds/metal_spin.mp3', fallbackSound: '/sounds/golden-buzzer.mp3' },
  { id: 'game', keywords: ['game', '🎮', 'controller', 'gaming'], video: '/gift-videos/game.webm', sound: '/sounds/click.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'wand', keywords: ['wand', '🪄', 'magic', 'spell'], video: '/gift-videos/wand.webm', sound: '/sounds/wand.mp3', fallbackSound: '/sounds/confetti.mp3' },
  { id: 'supercar', keywords: ['supercar', 'sports car', '🏎️'], video: '/gift-videos/supercar.webm', sound: '/sounds/supercar.mp3', fallbackSound: '/sounds/car.mp3' },
  { id: 'troll', keywords: ['troll', '🧌'], video: '/gift-videos/troll.webm', sound: '/sounds/troll.mp3', fallbackSound: '/sounds/evil_laugh.mp3' },
  { id: 'shield', keywords: ['shield', '🛡', 'armor', 'defense'], video: '/gift-videos/shield.webm', sound: '/sounds/tool.mp3', fallbackSound: '/sounds/click.mp3' },
];

/**
 * Find the video/sound entry for a gift by name and icon
 */
export function findGiftVideo(name: string, icon: string): GiftVideoEntry | null {
  const search = `${name} ${icon}`.toLowerCase().replace(/[_-]/g, ' ');
  for (const entry of GIFT_VIDEO_MAP) {
    for (const kw of entry.keywords) {
      if (search.includes(kw)) return entry;
    }
  }
  return null;
}

/**
 * Play a sound file
 */
export function playSound(src: string): HTMLAudioElement | null {
  try {
    const safeSrc = src.includes('/sounds/lighter.mp3') ? '/sounds/click.mp3' : src;
    const audio = new Audio(safeSrc);
    audio.volume = 0.7;
    audio.play().catch(() => {});
    return audio;
  } catch {
    return null;
  }
}

/**
 * Preload all sounds
 */
export function preloadAllSounds(): void {
  const allSounds = new Set<string>();
  GIFT_VIDEO_MAP.forEach(e => {
    allSounds.add(e.sound.includes('/sounds/lighter.mp3') ? '/sounds/click.mp3' : e.sound);
    allSounds.add(e.fallbackSound.includes('/sounds/lighter.mp3') ? '/sounds/click.mp3' : e.fallbackSound);
  });
  allSounds.forEach(src => {
    try {
      const a = new Audio(src);
      a.preload = 'auto';
      a.load();
    } catch {}
  });
}
