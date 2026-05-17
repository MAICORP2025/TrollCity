export type ThemeEffectType =
  | 'cashfall-storm'
  | 'money-rain-vault'
  | 'smoker-cloud-drift'
  | 'blue-haze-roll'
  | 'neon-bar-pour'
  | 'pink-champagne-lounge'
  | 'crystal-rose-shine'
  | 'butterfly-glitter-sky'
  | 'rainbow-flag-motion'
  | 'pride-wave-lights'
  | 'parts-and-pistons'
  | 'street-roll-motion'
  | 'mic-drop-reactor'
  | 'note-wave-studio'
  | 'ceo-gold-premium'
  | 'default';

export type ThemeLike = {
  id: string;
  name: string;
  category: string;
};

export function getThemeEffectType(theme: ThemeLike): ThemeEffectType {
  const id = theme.id.toLowerCase();
  const name = theme.name.toLowerCase();

  if (id === 'cash-1' || name.includes('cashfall')) return 'cashfall-storm';
  if (id === 'cash-2' || name.includes('vault')) return 'money-rain-vault';
  if (id === 'smoke-1' || name.includes('cloud drift')) return 'smoker-cloud-drift';
  if (id === 'smoke-2' || name.includes('blue haze')) return 'blue-haze-roll';
  if (id === 'drinks-1' || name.includes('neon bar')) return 'neon-bar-pour';
  if (id === 'drinks-2' || name.includes('champagne')) return 'pink-champagne-lounge';
  if (id === 'girly-1' || name.includes('crystal rose')) return 'crystal-rose-shine';
  if (id === 'girly-2' || name.includes('butterfly glitter')) return 'butterfly-glitter-sky';
  if (id === 'pride-1' || name.includes('flag motion')) return 'rainbow-flag-motion';
  if (id === 'pride-2' || name.includes('wave lights')) return 'pride-wave-lights';
  if (id === 'car-1' || name.includes('parts and pistons')) return 'parts-and-pistons';
  if (id === 'car-2' || name.includes('street roll')) return 'street-roll-motion';
  if (id === 'music-1' || name.includes('mic drop')) return 'mic-drop-reactor';
  if (id === 'music-2' || name.includes('note wave')) return 'note-wave-studio';
  if (id === 'ceo_gold_premium' || name.includes('ceo')) return 'ceo-gold-premium';

  if (theme.category === 'cash') return 'cashfall-storm';
  if (theme.category === 'smoke') return 'smoker-cloud-drift';
  if (theme.category === 'drinks') return 'pink-champagne-lounge';
  if (theme.category === 'girly') return 'butterfly-glitter-sky';
  if (theme.category === 'pride') return 'pride-wave-lights';
  if (theme.category === 'car') return 'street-roll-motion';
  if (theme.category === 'music') return 'note-wave-studio';

  return 'default';
}
