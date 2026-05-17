import type { BroadcastCategoryId } from '../config/broadcastCategories';
import type { ThemeEffectType } from '../components/themes/themeEffectMap';

export const DEFAULT_BROADCAST_THEME_ID = 'default';
export const CEO_BROADCAST_THEME_ID = 'ceo_gold_premium';
export const CEO_THEME_ALLOWED_USER_ID = '8dff9f37-21b5-4b8e-adc2-b9286874be1a';
export const CEO_THEME_ALLOWED_EMAIL = 'trollcity2025@gmail.com';

const ALL_BROADCAST_CATEGORIES: BroadcastCategoryId[] = [
  'general',
  'gaming',
  'irl',
  'debate',
  'education',
  'fitness',
  'business',
  'spiritual',
  'election',
  'tcnn',
  'battle',
];

type BroadcastThemeCategory =
  | 'cash'
  | 'smoke'
  | 'drinks'
  | 'girly'
  | 'pride'
  | 'car'
  | 'music'
  | 'ceo';

export interface BroadcastTheme {
  id: string;
  label: string;
  category: BroadcastThemeCategory;
  accentColor: string;
  effectType: ThemeEffectType;
  allowedCategories: BroadcastCategoryId[] | ['all'];
  playerFrameClassName: string;
  shellClassName: string;
  overlayClassName: string;
  fallbackCardClassName: string;
  accentClassName: string;
}

const SHARED_ALLOWED_CATEGORIES: BroadcastCategoryId[] = [...ALL_BROADCAST_CATEGORIES];

export const BROADCAST_THEMES: BroadcastTheme[] = [
  {
    id: 'cash-1',
    label: 'Cashfall Storm',
    category: 'cash',
    accentColor: '#22c55e',
    effectType: 'cashfall-storm',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--cashfall-storm',
    shellClassName: 'theme-shell theme-cashfall-storm',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--cashfall-storm',
    fallbackCardClassName: 'bg-emerald-900/20 border border-emerald-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-emerald-300 border-emerald-400/30 bg-emerald-900/20',
  },
  {
    id: 'cash-2',
    label: 'Money Rain Vault',
    category: 'cash',
    accentColor: '#eab308',
    effectType: 'money-rain-vault',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--money-rain-vault',
    shellClassName: 'theme-shell theme-money-rain-vault',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--money-rain-vault',
    fallbackCardClassName: 'bg-amber-900/20 border border-amber-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-amber-300 border-amber-400/30 bg-amber-900/20',
  },
  {
    id: 'smoke-1',
    label: 'Smoker Cloud Drift',
    category: 'smoke',
    accentColor: '#22c55e',
    effectType: 'smoker-cloud-drift',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--smoker-cloud-drift',
    shellClassName: 'theme-shell theme-smoker-cloud-drift',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--smoker-cloud-drift',
    fallbackCardClassName: 'bg-lime-900/20 border border-lime-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-lime-300 border-lime-400/30 bg-lime-900/20',
  },
  {
    id: 'smoke-2',
    label: 'Blue Haze Roll',
    category: 'smoke',
    accentColor: '#22d3ee',
    effectType: 'blue-haze-roll',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--blue-haze-roll',
    shellClassName: 'theme-shell theme-blue-haze-roll',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--blue-haze-roll',
    fallbackCardClassName: 'bg-cyan-900/20 border border-cyan-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-cyan-300 border-cyan-400/30 bg-cyan-900/20',
  },
  {
    id: 'drinks-1',
    label: 'Neon Bar Pour',
    category: 'drinks',
    accentColor: '#f59e0b',
    effectType: 'neon-bar-pour',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--neon-bar-pour',
    shellClassName: 'theme-shell theme-neon-bar-pour',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--neon-bar-pour',
    fallbackCardClassName: 'bg-orange-900/20 border border-orange-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-orange-300 border-orange-400/30 bg-orange-900/20',
  },
  {
    id: 'drinks-2',
    label: 'Pink Champagne Lounge',
    category: 'drinks',
    accentColor: '#ec4899',
    effectType: 'pink-champagne-lounge',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--pink-champagne-lounge',
    shellClassName: 'theme-shell theme-pink-champagne-lounge',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--pink-champagne-lounge',
    fallbackCardClassName: 'bg-pink-900/20 border border-pink-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-pink-300 border-pink-400/30 bg-pink-900/20',
  },
  {
    id: 'girly-1',
    label: 'Crystal Rose Shine',
    category: 'girly',
    accentColor: '#f472b6',
    effectType: 'crystal-rose-shine',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--crystal-rose-shine',
    shellClassName: 'theme-shell theme-crystal-rose-shine',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--crystal-rose-shine',
    fallbackCardClassName: 'bg-fuchsia-900/20 border border-fuchsia-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-900/20',
  },
  {
    id: 'girly-2',
    label: 'Butterfly Glitter Sky',
    category: 'girly',
    accentColor: '#e879f9',
    effectType: 'butterfly-glitter-sky',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--butterfly-glitter-sky',
    shellClassName: 'theme-shell theme-butterfly-glitter-sky',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--butterfly-glitter-sky',
    fallbackCardClassName: 'bg-violet-900/20 border border-violet-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-violet-300 border-violet-400/30 bg-violet-900/20',
  },
  {
    id: 'pride-1',
    label: 'Rainbow Flag Motion',
    category: 'pride',
    accentColor: '#8b5cf6',
    effectType: 'rainbow-flag-motion',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--rainbow-flag-motion',
    shellClassName: 'theme-shell theme-rainbow-flag-motion',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--rainbow-flag-motion',
    fallbackCardClassName: 'bg-indigo-900/20 border border-indigo-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-indigo-300 border-indigo-400/30 bg-indigo-900/20',
  },
  {
    id: 'pride-2',
    label: 'Pride Wave Lights',
    category: 'pride',
    accentColor: '#34d399',
    effectType: 'pride-wave-lights',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--pride-wave-lights',
    shellClassName: 'theme-shell theme-pride-wave-lights',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--pride-wave-lights',
    fallbackCardClassName: 'bg-teal-900/20 border border-teal-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-teal-300 border-teal-400/30 bg-teal-900/20',
  },
  {
    id: 'car-1',
    label: 'Parts and Pistons',
    category: 'car',
    accentColor: '#3b82f6',
    effectType: 'parts-and-pistons',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--parts-and-pistons',
    shellClassName: 'theme-shell theme-parts-and-pistons',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--parts-and-pistons',
    fallbackCardClassName: 'bg-blue-900/20 border border-blue-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-blue-300 border-blue-400/30 bg-blue-900/20',
  },
  {
    id: 'car-2',
    label: 'Street Roll Motion',
    category: 'car',
    accentColor: '#f97316',
    effectType: 'street-roll-motion',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--street-roll-motion',
    shellClassName: 'theme-shell theme-street-roll-motion',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--street-roll-motion',
    fallbackCardClassName: 'bg-orange-900/20 border border-orange-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-orange-300 border-orange-400/30 bg-orange-900/20',
  },
  {
    id: 'music-1',
    label: 'Mic Drop Reactor',
    category: 'music',
    accentColor: '#8b5cf6',
    effectType: 'mic-drop-reactor',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--mic-drop-reactor',
    shellClassName: 'theme-shell theme-mic-drop-reactor',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--mic-drop-reactor',
    fallbackCardClassName: 'bg-purple-900/20 border border-purple-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-purple-300 border-purple-400/30 bg-purple-900/20',
  },
  {
    id: 'music-2',
    label: 'Note Wave Studio',
    category: 'music',
    accentColor: '#06b6d4',
    effectType: 'note-wave-studio',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--note-wave-studio',
    shellClassName: 'theme-shell theme-note-wave-studio',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--note-wave-studio',
    fallbackCardClassName: 'bg-sky-900/20 border border-sky-400/40 rounded-lg p-8 text-center',
    accentClassName: 'text-sky-300 border-sky-400/30 bg-sky-900/20',
  },
  {
    id: CEO_BROADCAST_THEME_ID,
    label: 'CEO Gold Premium',
    category: 'ceo',
    accentColor: '#facc15',
    effectType: 'ceo-gold-premium',
    allowedCategories: SHARED_ALLOWED_CATEGORIES,
    playerFrameClassName: 'tc-theme-frame tc-theme-frame--ceo-gold-premium',
    shellClassName: 'theme-shell theme-ceo-gold-premium',
    overlayClassName: 'tc-theme-overlay tc-theme-overlay--ceo-gold-premium',
    fallbackCardClassName: 'bg-yellow-900/20 border border-yellow-400/50 rounded-lg p-8 text-center',
    accentClassName: 'text-yellow-300 border-yellow-400/30 bg-yellow-900/20',
  },
];

export function isCeoThemeEligible(userId?: string | null, email?: string | null): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  return userId === CEO_THEME_ALLOWED_USER_ID && normalizedEmail === CEO_THEME_ALLOWED_EMAIL;
}

export function getSelectableBroadcastThemes(options?: { includeCeoTheme?: boolean }): BroadcastTheme[] {
  const includeCeoTheme = options?.includeCeoTheme === true;
  return BROADCAST_THEMES.filter((theme) => includeCeoTheme || theme.id !== CEO_BROADCAST_THEME_ID);
}

export function getBroadcastTheme(themeId: string | null | undefined, category: string): BroadcastTheme | null {
  if (!themeId || themeId === DEFAULT_BROADCAST_THEME_ID) return null;

  const theme = BROADCAST_THEMES.find((entry) => entry.id === themeId);
  if (!theme) return null;

  if (theme.allowedCategories[0] === 'all') return theme;

  if (!category) return theme;
  const allowedCategories = theme.allowedCategories as BroadcastCategoryId[];
  return allowedCategories.includes(category as BroadcastCategoryId) ? theme : null;
}
