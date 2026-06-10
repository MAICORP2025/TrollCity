import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';

// Track which challenges have been incremented this session to avoid double-counting
const sessionTracked = new Set<string>();

/**
 * Track a pride challenge action by action_type.
 * Called from various places in the app when users perform actions.
 */
export async function trackPrideAction(
  userId: string,
  actionType: string,
  amount: number = 1
): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    // Find active challenges matching this action_type
    const { data: challenges } = await supabase
      .from('pride_challenges')
      .select('id, slug, target_value, starts_at, ends_at')
      .eq('action_type', actionType)
      .eq('is_active', true);

    if (!challenges || challenges.length === 0) return;

    const now = new Date();

    for (const challenge of challenges) {
      // Check if challenge is within its time window
      if (challenge.starts_at && now < new Date(challenge.starts_at)) continue;
      if (challenge.ends_at && now > new Date(challenge.ends_at)) continue;

      const trackingKey = `${userId}_${challenge.id}_${actionType}_${Math.floor(now.getTime() / 60000)}`;

      // For boolean challenges, only complete once
      if (challenge.target_value === 1) {
        const { data: progress } = await supabase
          .from('pride_user_progress')
          .select('is_completed')
          .eq('user_id', userId)
          .eq('challenge_id', challenge.id)
          .single();

        if (progress?.is_completed) continue;

        await supabase.rpc('pride_complete_challenge', {
          p_user_id: userId,
          p_challenge_id: challenge.id,
        });
      } else {
        // For count challenges, use increment RPC with dedup
        if (sessionTracked.has(trackingKey)) continue;
        sessionTracked.add(trackingKey);

        await supabase.rpc('pride_increment_progress', {
          p_user_id: userId,
          p_challenge_id: challenge.id,
          p_amount: amount,
        });
      }
    }
  } catch (err) {
    // Silent fail - don't break user experience for tracking
    console.debug('[PrideTracker] Action tracking error:', err);
  }
}
