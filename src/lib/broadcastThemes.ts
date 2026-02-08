import { supabase } from './supabase';
import { runStandardPurchaseFlow } from './purchases';

export interface BroadcastTheme {
  id: string;
  name: string;
  cost: number;
  description?: string;
  cssClass?: string;
}

// These match the ones in CoinStore.jsx, moved here for centralization
export const BROADCAST_THEMES: BroadcastTheme[] = [
  { id: 'theme_neon', name: 'Neon Nights', cost: 500, description: 'Glowing neon borders', cssClass: 'theme-neon' },
  { id: 'theme_gold', name: 'Golden Luxury', cost: 1000, description: 'Gold plated interface', cssClass: 'theme-gold' },
  { id: 'theme_matrix', name: 'The Matrix', cost: 800, description: 'Digital rain effect', cssClass: 'theme-matrix' },
  { id: 'theme_retro', name: 'Retro Wave', cost: 600, description: '80s synthwave style', cssClass: 'theme-retro' },
  { id: 'theme_ice', name: 'Ice Cold', cost: 700, description: 'Frozen glass effect', cssClass: 'theme-ice' },
  { id: 'theme_fire', name: 'Inferno', cost: 900, description: 'Animated fire borders', cssClass: 'theme-fire' }
];

/**
 * Purchase a broadcast theme
 */
export async function purchaseBroadcastTheme(
  userId: string,
  theme: BroadcastTheme
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Validate
    if (!theme || theme.cost <= 0) {
      return { success: false, error: 'Invalid theme' };
    }

    // 2. Check ownership (optional, runStandardPurchaseFlow doesn't check it before deduction, 
    // but we can check here to save a transaction)
    const { data: existing } = await supabase
      .from('user_broadcast_theme_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('theme_id', theme.id)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'Already owned' };
    }

    // 3. Run Standard Purchase Flow
    return await runStandardPurchaseFlow({
      userId,
      amount: theme.cost,
      transactionType: 'broadcast_theme',
      description: `Purchased ${theme.name} broadcast theme`,
      metadata: {
        theme_id: theme.id,
        theme_name: theme.name
      },
      ensureOwnership: async (client) => {
        const { error } = await client
          .from('user_broadcast_theme_purchases')
          .insert({
            user_id: userId,
            theme_id: theme.id,
            purchased_at: new Date().toISOString()
          });

        if (error) {
          // If error is unique violation, it's fine, user has it.
          if (error.code === '23505') { // unique_violation
             return { success: true };
          }
          return { success: false, error: error.message };
        }
        return { success: true };
      }
    });

  } catch (err: any) {
    console.error('Purchase broadcast theme error:', err);
    return { success: false, error: err.message || 'Purchase failed' };
  }
}
