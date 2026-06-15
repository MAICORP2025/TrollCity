import { supabase } from '@/lib/supabase';

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
    const { data: challenges } = await supabase
      .from('pride_challenges')
      .select('id, slug, target_value, starts_at, ends_at')
      .eq('action_type', actionType)
      .eq('is_active', true);

    if (!challenges || challenges.length === 0) return;

    const now = new Date();

    for (const challenge of challenges) {
      if (challenge.starts_at && now < new Date(challenge.starts_at)) continue;
      if (challenge.ends_at && now > new Date(challenge.ends_at)) continue;

      const trackingKey = `${userId}_${challenge.id}_${actionType}_${Math.floor(now.getTime() / 60000)}`;

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
        if (sessionTracked.has(trackingKey)) continue;
        sessionTracked.add(trackingKey);

        await supabase.rpc('pride_increment_progress', {
          p_user_id: userId,
          p_challenge_id: challenge.id,
          p_amount: amount,
        });
      }
    }

    // After any progress, check if complete_all should trigger
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Action tracking error:', err);
  }
}

/**
 * Track a wall post action (like, reply, create post, share moment).
 */
export async function trackPrideWallAction(
  userId: string,
  actionType: 'like_posts' | 'reply_posts' | 'wall_posts' | 'share_moment',
  targetUserId?: string
): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    await supabase.rpc('pride_track_wall_action', {
      p_user_id: userId,
      p_action_type: actionType,
      p_target_user_id: targetUserId || null,
    });
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Wall action error:', err);
  }
}

/**
 * Track sending a gift to another user.
 */
export async function trackPrideGift(
  userId: string,
  recipientUserId: string,
  giftType: string = 'generic'
): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    await supabase.rpc('pride_track_gift', {
      p_user_id: userId,
      p_recipient_user_id: recipientUserId,
      p_gift_type: giftType,
    });
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Gift tracking error:', err);
  }
}

/**
 * Track a battle win.
 */
export async function trackPrideBattleWin(
  userId: string,
  hasPrideTheme: boolean = false
): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    await supabase.rpc('pride_track_battle_win', {
      p_user_id: userId,
      p_has_pride_theme: hasPrideTheme,
    });
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Battle win error:', err);
  }
}

/**
 * Track going live / starting a broadcast.
 */
export async function trackPrideGoLive(userId: string): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    await supabase.rpc('pride_track_go_live', {
      p_user_id: userId,
    });
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Go live error:', err);
  }
}

/**
 * Track visiting a neighborhood.
 */
export async function trackPrideVisit(
  userId: string,
  neighborhood?: string
): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    await supabase.rpc('pride_track_visit', {
      p_user_id: userId,
      p_neighborhood: neighborhood || null,
    });
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Visit error:', err);
  }
}

/**
 * Track inviting a friend.
 */
export async function trackPrideInvite(userId: string): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    await supabase.rpc('pride_track_invite', {
      p_user_id: userId,
    });
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Invite error:', err);
  }
}

/**
 * Track adding a badge to profile.
 */
export async function trackPrideBadge(userId: string): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    await supabase.rpc('pride_track_badge', {
      p_user_id: userId,
    });
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Badge error:', err);
  }
}

/**
 * Track credit spending for pride_celebration challenge.
 */
export async function trackPrideSpending(
  userId: string,
  amount: number = 0
): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    await supabase.rpc('pride_track_spending', {
      p_user_id: userId,
      p_amount: amount,
    });
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Spending error:', err);
  }
}

/**
 * Track daily active login for active_days challenge.
 * Should be called once per day when the user logs in.
 */
export async function trackPrideDailyActive(userId: string): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `pride_active_${userId}_${today}`;

    if (sessionTracked.has(storageKey)) return;
    sessionTracked.add(storageKey);

    const { data: challenges } = await supabase
      .from('pride_challenges')
      .select('id, target_value, starts_at, ends_at')
      .eq('action_type', 'active_days')
      .eq('is_active', true);

    if (!challenges || challenges.length === 0) return;

    const now = new Date();
    for (const challenge of challenges) {
      if (challenge.starts_at && now < new Date(challenge.starts_at)) continue;
      if (challenge.ends_at && now > new Date(challenge.ends_at)) continue;

      await supabase.rpc('pride_increment_progress', {
        p_user_id: userId,
        p_challenge_id: challenge.id,
        p_amount: 1,
      });
    }

    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Daily active error:', err);
  }
}

/**
 * Track adding a friend for add_friends challenge.
 */
export async function trackPrideAddFriend(userId: string): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    const { data: challenges } = await supabase
      .from('pride_challenges')
      .select('id, target_value, starts_at, ends_at')
      .eq('action_type', 'add_friends')
      .eq('is_active', true);

    if (!challenges || challenges.length === 0) return;

    const now = new Date();
    for (const challenge of challenges) {
      if (challenge.starts_at && now < new Date(challenge.starts_at)) continue;
      if (challenge.ends_at && now > new Date(challenge.ends_at)) continue;

      await supabase.rpc('pride_increment_progress', {
        p_user_id: userId,
        p_challenge_id: challenge.id,
        p_amount: 1,
      });
    }

    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Add friend error:', err);
  }
}

/**
 * Track reaching a leaderboard position for reach_leaderboard challenge.
 */
export async function trackPrideLeaderboard(
  userId: string,
  position: number = 0
): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;
  if (position > 10 || position <= 0) return;

  try {
    await supabase.rpc('pride_complete_challenge', {
      p_user_id: userId,
      p_challenge_id: (
        await supabase
          .from('pride_challenges')
          .select('id')
          .eq('action_type', 'reach_leaderboard')
          .eq('is_active', true)
          .single()
      ).data?.id,
    });
    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Leaderboard error:', err);
  }
}

/**
 * Track voice room time for voice_room challenge.
 * Call periodically (e.g., every 5 minutes) while user is in a voice room.
 */
export async function trackPrideVoiceTime(
  userId: string,
  minutes: number = 5
): Promise<void> {
  if (!userId || userId.startsWith('TC-')) return;

  try {
    const { data: challenges } = await supabase
      .from('pride_challenges')
      .select('id, target_value, starts_at, ends_at')
      .eq('action_type', 'voice_room')
      .eq('is_active', true);

    if (!challenges || challenges.length === 0) return;

    const now = new Date();
    for (const challenge of challenges) {
      if (challenge.starts_at && now < new Date(challenge.starts_at)) continue;
      if (challenge.ends_at && now > new Date(challenge.ends_at)) continue;

      await supabase.rpc('pride_increment_progress', {
        p_user_id: userId,
        p_challenge_id: challenge.id,
        p_amount: minutes,
      });
    }

    await supabase.rpc('pride_check_complete_all', { p_user_id: userId });
  } catch (err) {
    console.debug('[PrideTracker] Voice time error:', err);
  }
}
