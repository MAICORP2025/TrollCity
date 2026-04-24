import { supabase } from './supabase';

export interface BroadcastTheme {
  id: string;
  label: string;
  allowedCategories: string[];
  playerFrameClassName: string;
  shellClassName: string;
  overlayClassName: string;
  fallbackCardClassName: string;
  accentClassName: string;
}

export const BROADCAST_THEMES: BroadcastTheme[] = [
  {
    id: 'ceo_gold_premium',
    label: 'CEO Gold Premium',
    allowedCategories: ['General Chat'],
    playerFrameClassName: 'relative border-4 border-yellow-400/80 rounded-lg shadow-2xl shadow-yellow-400/20',
    shellClassName: 'relative p-2 bg-gradient-to-br from-gray-900 via-black to-gray-900 rounded-xl shadow-2xl',
    overlayClassName: 'absolute inset-0 rounded-xl bg-gradient-to-t from-yellow-500/5 to-transparent pointer-events-none',
    fallbackCardClassName: 'bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border border-yellow-400/50 rounded-lg p-8 text-center',
    accentClassName: 'text-yellow-400 border-yellow-400/30 bg-yellow-900/20'
  }
];

export function getBroadcastTheme(themeId: string | null | undefined, category: string): BroadcastTheme | null {
  if (!themeId) return null;

  const theme = BROADCAST_THEMES.find(t => t.id === themeId);
  if (!theme) return null;

  // Check if category is allowed
  if (!theme.allowedCategories.includes(category)) return null;

  return theme;
}
