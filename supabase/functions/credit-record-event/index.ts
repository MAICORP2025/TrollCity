// Edge Function: credit-record-event
// Purpose: single entry point to apply a credit scoring event with caps + clamping
// Runtime: Deno (Edge)

export const config = { runtime: "edge" };

import { supabase } from "../_shared/supabaseClient.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Scoring rules with daily/weekly caps
// windowDays controls the period for the cap (1 = daily, 7 = weekly)
const RULES: Record<string, { base: number; cap?: number; windowDays?: number }> = {
  // Increases
  daily_checkin: { base: 1, cap: 1, windowDays: 1 },
  stream_session: { base: 2, cap: 6, windowDays: 1 },
  stream_streak_bonus: { base: 3, cap: 3, windowDays: 7 },
  chat_message_meaningful: { base: 1, cap: 3, windowDays: 1 },
  gift_action: { base: 1, cap: 5, windowDays: 1 },
  gift_threshold_bonus: { base: 2, cap: 2, windowDays: 1 },
  positive_reactions: { base: 1, cap: 3, windowDays: 1 },
  trollcourt_win: { base: 5, cap: 10, windowDays: 7 },
  loan_on_time_payment: { base: 4, cap: 12, windowDays: 7 },
  loan_full_payoff: { base: 8 },

  // Decreases
  chat_mute: { base: -5, cap: -10, windowDays: 1 },
  warning: { base: -3, cap: -9, windowDays: 1 },
  trollcourt_loss: { base: -5, cap: -10, windowDays: 7 },
  inactivity_3d: { base: -2 },
  inactivity_7d: { base: -8 },
  inactivity_14d: { base: -20 },
  chargeback: { base: -25 },
  spam_flag: { base: -10, cap: -30, windowDays: 1 },
  loan_late_payment: { base: -2, cap: -20, windowDays: 7 },
  loan_missed_payment: { base: -15 },
  loan_default: { base: -60 },
  loan_high_outstanding: { base: -1, cap: -5, windowDays: 1 },
};

function clampScore(score: number): number {
  if (score < 0) return 0;
  if (score > 800) return 800;
  return score;
}

function getTier(score: number): string {
  if (score < 150) return "Untrusted";
  if (score < 300) return "Shaky";
  if (score < 450) return "Building";
  if (score < 600) return "Reliable";
  if (score < 700) return "Trusted";
  return "Elite";
}

function trendFromDelta(sum7d: number): number {
  if (sum7d > 0) return 1;
  if (sum7d < 0) return -1;
  return 0;
}

async function getCappedDelta(
  userId: string,
  eventType: string,
  baseDelta: number,
  cap?: number,
  windowDays?: number
): Promise<number> {
  if (cap === undefined) return baseDelta;
  const windowStart = new Date(Date.now() - (windowDays ?? 1) * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("credit_events")
    .select("delta")
    .eq("user_id", userId)
    .eq("event_type", eventType)
    .gte("created_at", windowStart.toISOString());

  if (error) throw error;
  const currentSum = (data || []).reduce((sum, row) => sum + (row.delta ?? 0), 0);

  // Positive caps
  if (cap > 0) {
    const remaining = cap - currentSum;
    if (remaining <= 0) return 0;
    return Math.min(baseDelta, remaining);
  }

  // Negative caps (cap is negative)
  const remainingNeg = cap - currentSum; // cap and currentSum are negative or zero
  if (remainingNeg >= 0) return 0; // already met or exceeded negative cap
  return Math.max(baseDelta, remainingNeg);
}

async function compute7dTrend(userId: string): Promise<number> {
  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("credit_events")
    .select("delta")
    .eq("user_id", userId)
    .gte("created_at", windowStart.toISOString());
  if (error) throw error;
  const sum7d = (data || []).reduce((sum, row) => sum + (row.delta ?? 0), 0);
  return trendFromDelta(sum7d);
}

async function getOrInitUserCredit(userId: string) {
  const { data, error } = await supabase
    .from("user_credit")
    .select("user_id, score, tier, trend_7d, loan_reliability")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  // Seed default row
  const insertResp = await supabase
    .from("user_credit")
    .insert({ user_id: userId })
    .select("user_id, score, tier, trend_7d, loan_reliability")
    .single();
  if (insertResp.error) throw insertResp.error;
  return insertResp.data;
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  try {
    const body = await req.json();
    const {
      user_id,
      event_type,
      event_key,
      metadata = {},
      override_delta,
      loan_reliability
    } = body || {};

    if (!user_id || !event_type) {
      return new Response(JSON.stringify({ error: "user_id and event_type are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Idempotency check
    if (event_key) {
      const { data: existing } = await supabase
        .from("credit_events")
        .select("id")
        .eq("event_key", event_key)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "duplicate" }), {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    const rule = RULES[event_type];
    const baseDelta = override_delta ?? rule?.base;
    if (baseDelta === undefined) {
      return new Response(JSON.stringify({ error: "Unknown event_type and no override_delta provided" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const delta = await getCappedDelta(
      user_id,
      event_type,
      baseDelta,
      rule?.cap,
      rule?.windowDays ?? 1
    );

    if (delta === 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "cap reached" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Fetch or seed current score
    const credit = await getOrInitUserCredit(user_id);
    const nextScore = clampScore((credit.score ?? 400) + delta);
    const nextTier = getTier(nextScore);

    const trend7d = await compute7dTrend(user_id).catch(() => credit.trend_7d ?? 0);

    // Insert credit event
    const insertEvent = await supabase.from("credit_events").insert({
      user_id,
      event_type,
      delta,
      event_key,
      metadata,
    });
    if (insertEvent.error) throw insertEvent.error;

    // Update user_credit
    const updateResp = await supabase
      .from("user_credit")
      .upsert({
        user_id,
        score: nextScore,
        tier: nextTier,
        trend_7d: trend7d,
        loan_reliability: loan_reliability ?? credit.loan_reliability ?? 0,
        updated_at: new Date().toISOString(),
        last_event_at: new Date().toISOString(),
      });
    if (updateResp.error) throw updateResp.error;

    // 🏆 Trigger Badge Evaluation
    try {
        const { data: stats } = await supabase.rpc('get_loan_stats', { p_user_id: user_id });
        
        if (stats) {
            // Determine badge event type based on credit event
            let badgeEventType = 'credit_score'; // Default
            if (event_type === 'loan_full_payoff') badgeEventType = 'loan_repaid';
            if (event_type === 'loan_on_time_payment') badgeEventType = 'loan_repaid'; // Mapped for 'on-time-payer' rule check
            
            // Add score to metadata for 'trusted-borrower' check
            const metadataWithScore = { 
                ...stats, 
                score: nextScore,
                // approximate streak based on trend or reliability if not tracked explicitly
                // For now, we rely on stats from get_loan_stats for loan badges
            };

            const functionsUrl = Deno.env.get("SUPABASE_URL")!.replace('.co', '.co/functions/v1');
            fetch(`${functionsUrl}/evaluate-badges-for-event`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    event_type: badgeEventType,
                    user_id: user_id,
                    metadata: metadataWithScore
                })
            }).catch(e => console.error('Badge eval failed', e));
        }
    } catch (badgeErr) {
        console.error('Badge trigger error', badgeErr);
    }

    return new Response(
      JSON.stringify({ success: true, delta, score: nextScore, tier: nextTier, trend_7d: trend7d }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("credit-record-event error", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
