import { supabase } from "./supabaseClient.ts";

export interface AwardBadgeParams {
  userId: string;
  badgeSlug: string;
  metadata?: Record<string, unknown>;
}

export interface AwardBadgeResult {
  awarded: boolean;
  badgeId?: string;
  badgeSlug?: string;
  earnedAt?: string;
  reason?: string;
}

export async function awardBadge({ userId, badgeSlug, metadata }: AwardBadgeParams): Promise<AwardBadgeResult> {
  const { data: badge, error: badgeError } = await supabase
    .from("badge_catalog")
    .select("id, slug, is_active")
    .eq("slug", badgeSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (badgeError) {
    return { awarded: false, reason: badgeError.message };
  }
  if (!badge) {
    return { awarded: false, reason: "badge_not_found" };
  }

  const insertResp = await supabase
    .from("user_badges")
    .insert({ user_id: userId, badge_id: badge.id, metadata: metadata ?? {} })
    .select("badge_id, earned_at")
    .single();

  if (insertResp.error) {
    const code = (insertResp.error as any)?.code;
    if (code === "23505") {
      return { awarded: false, badgeId: badge.id, badgeSlug: badge.slug, reason: "already_awarded" };
    }
    return { awarded: false, reason: insertResp.error.message };
  }

  return {
    awarded: true,
    badgeId: insertResp.data?.badge_id,
    badgeSlug: badge.slug,
    earnedAt: insertResp.data?.earned_at as string | undefined,
  };
}
