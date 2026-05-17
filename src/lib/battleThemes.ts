export interface BattleThemeDefinition {
  id: string;
  label: string;
  description: string;
  className: string;
  previewClassName: string;
  isFree: boolean;
}

export const DEFAULT_BATTLE_THEME_ID = 'cash-flow';

export const BATTLE_THEMES: BattleThemeDefinition[] = [
  { id: 'cash-flow', label: 'Cash Flow', description: 'Currency particles and wealth pulses', className: 'battle-theme-cash-flow', previewClassName: 'battle-theme-preview-cash-flow', isFree: true },
  { id: 'vault-room', label: 'Vault Room', description: 'Metallic vault walls and gold beams', className: 'battle-theme-vault-room', previewClassName: 'battle-theme-preview-vault-room', isFree: true },
  { id: 'stock-market-war', label: 'Stock Market War', description: 'Red vs green chart battlefield', className: 'battle-theme-stock-market-war', previewClassName: 'battle-theme-preview-stock-market-war', isFree: true },
  { id: 'midnight-street-race', label: 'Midnight Street Race', description: 'Neon speed streak arena', className: 'battle-theme-midnight-street-race', previewClassName: 'battle-theme-preview-midnight-street-race', isFree: true },
  { id: 'luxury-garage', label: 'Luxury Garage', description: 'Showroom reflections and sweeps', className: 'battle-theme-luxury-garage', previewClassName: 'battle-theme-preview-luxury-garage', isFree: true },
  { id: 'turbo-boost-arena', label: 'Turbo Boost Arena', description: 'Center acceleration pulse', className: 'battle-theme-turbo-boost-arena', previewClassName: 'battle-theme-preview-turbo-boost-arena', isFree: true },
  { id: 'neon-kitchen', label: 'Neon Kitchen', description: 'Heat shimmer and steam particles', className: 'battle-theme-neon-kitchen', previewClassName: 'battle-theme-preview-neon-kitchen', isFree: true },
  { id: 'street-food-night', label: 'Street Food Night', description: 'Ambient sign glows and flicker', className: 'battle-theme-street-food-night', previewClassName: 'battle-theme-preview-street-food-night', isFree: true },
  { id: 'bass-reactor', label: 'Bass Reactor', description: 'Reactive bars and waveform motion', className: 'battle-theme-bass-reactor', previewClassName: 'battle-theme-preview-bass-reactor', isFree: true },
  { id: 'concert-stage', label: 'Concert Stage', description: 'Stage lights and subtle fog', className: 'battle-theme-concert-stage', previewClassName: 'battle-theme-preview-concert-stage', isFree: true },
  { id: 'studio-mode', label: 'Studio Mode', description: 'Clean panel look with reactive glow', className: 'battle-theme-studio-mode', previewClassName: 'battle-theme-preview-studio-mode', isFree: true },
  { id: 'neon-bar', label: 'Neon Bar', description: 'Liquid gradients and glass glow', className: 'battle-theme-neon-bar', previewClassName: 'battle-theme-preview-neon-bar', isFree: true },
  { id: 'club-pulse', label: 'Club Pulse', description: 'Low-frequency nightlife pulse', className: 'battle-theme-club-pulse', previewClassName: 'battle-theme-preview-club-pulse', isFree: true },
  { id: 'troll-chaos', label: 'Troll Chaos', description: 'Glitch particles and distortion waves', className: 'battle-theme-troll-chaos', previewClassName: 'battle-theme-preview-troll-chaos', isFree: true },
  { id: 'courtroom-clash', label: 'Courtroom Clash', description: 'Dark wood tones and center spotlight', className: 'battle-theme-courtroom-clash', previewClassName: 'battle-theme-preview-courtroom-clash', isFree: true },
  { id: 'jail-block', label: 'Jail Block', description: 'Moving light through bars', className: 'battle-theme-jail-block', previewClassName: 'battle-theme-preview-jail-block', isFree: true },
];

const BATTLE_THEME_MAP = new Map(BATTLE_THEMES.map((theme) => [theme.id, theme]));

export function getBattleTheme(themeId: string | null | undefined): BattleThemeDefinition {
  const safeFallback = BATTLE_THEME_MAP.get(DEFAULT_BATTLE_THEME_ID) || BATTLE_THEMES[0];
  if (!safeFallback) {
    return {
      id: 'fallback',
      label: 'Fallback',
      description: 'Fallback theme',
      className: 'battle-theme-cash-flow',
      previewClassName: 'battle-theme-preview-cash-flow',
      isFree: true,
    };
  }
  if (!themeId) return safeFallback;
  return BATTLE_THEME_MAP.get(themeId) || safeFallback;
}

export function normalizeBattleTheme(themeId: string | null | undefined): string {
  return getBattleTheme(themeId).id;
}
