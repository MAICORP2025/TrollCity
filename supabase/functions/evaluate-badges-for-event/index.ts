// Edge Function: evaluate-badges-for-event
// Purpose: Route platform events into badge awards using simple thresholds
// Runtime: Deno (Edge)

export const config = { runtime: "edge" };

import { awardBadge } from "../_shared/badges.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type EventPayload = {
  event_type: string;
  user_id: string;
  metadata?: Record<string, unknown>;
};

type BadgeRule = {
  slug: string;
  test: (evt: EventPayload) => boolean;
};

const n = (val: unknown) => Number(val ?? 0) || 0;
const b = (val: unknown) => val === true;

const RULES: BadgeRule[] = [
  // Gifting
  { slug: "first-gift", test: (e) => e.event_type === "gift_sent" && n(e.metadata?.total_gifts) >= 1 },
  { slug: "generous-gifter", test: (e) => e.event_type === "gift_sent" && n(e.metadata?.total_gifts) >= 10 },
  { slug: "big-spender", test: (e) => e.event_type === "gift_sent" && n(e.metadata?.total_gift_amount) >= 50000 },
  { slug: "community-supporter", test: (e) => e.event_type === "gift_sent" && n(e.metadata?.unique_recipients) >= 10 },

  // Loans / Trust
  { slug: "first-loan-repaid", test: (e) => e.event_type === "loan_repaid" && n(e.metadata?.loan_repaid_count) >= 1 },
  { slug: "on-time-payer", test: (e) => e.event_type === "loan_repaid" && n(e.metadata?.on_time_payments) >= 5 },
  { slug: "debt-free", test: (e) => e.event_type === "loan_repaid" && (b(e.metadata?.paid_off) || n(e.metadata?.loans_paid_off) >= 1) },
  { slug: "trusted-borrower", test: (e) => e.event_type === "credit_score" && n(e.metadata?.score) >= 600 && n(e.metadata?.streak_days) >= 14 },
  { slug: "elite-reliability", test: (e) => e.event_type === "credit_score" && n(e.metadata?.score) >= 700 && n(e.metadata?.streak_days) >= 30 },

  // Check-ins / Consistency
  { slug: "first-checkin", test: (e) => e.event_type === "checkin" && n(e.metadata?.total_checkins) >= 1 },
  { slug: "streak-7", test: (e) => e.event_type === "checkin" && n(e.metadata?.checkin_streak) >= 7 },
  { slug: "streak-30", test: (e) => e.event_type === "checkin" && n(e.metadata?.checkin_streak) >= 30 },

  // Streaming
  { slug: "first-stream", test: (e) => e.event_type === "stream" && n(e.metadata?.minutes) >= 20 && n(e.metadata?.total_streams) >= 1 },
  { slug: "regular-streamer", test: (e) => e.event_type === "stream" && n(e.metadata?.stream_days_7d) >= 3 },
  { slug: "marathon-stream", test: (e) => e.event_type === "stream" && n(e.metadata?.minutes) >= 120 },

  // Community
  { slug: "first-reaction", test: (e) => e.event_type === "reaction_given" && n(e.metadata?.reaction_given_count) >= 10 },
  { slug: "popular", test: (e) => e.event_type === "reaction_received" && n(e.metadata?.unique_reaction_senders) >= 100 },

  // TrollCourt
  { slug: "first-win", test: (e) => e.event_type === "trollcourt" && n(e.metadata?.wins) >= 1 },
  { slug: "court-champion", test: (e) => e.event_type === "trollcourt" && n(e.metadata?.wins) >= 10 },

  // Safety / Moderation
  { slug: "clean-record", test: (e) => e.event_type === "moderation" && n(e.metadata?.clean_days) >= 30 },
];

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  try {
    const body = await req.json();
    const { event_type, user_id, metadata = {} } = body as EventPayload;

    if (!event_type || !user_id) {
      return new Response(JSON.stringify({ error: "event_type and user_id are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const event: EventPayload = { event_type, user_id, metadata };
    const matching = RULES.filter((rule) => rule.test(event));

    const results = [] as Awaited<ReturnType<typeof awardBadge>>[];
    for (const rule of matching) {
      const res = await awardBadge({ userId: user_id, badgeSlug: rule.slug, metadata });
      results.push(res);
    }

    return new Response(JSON.stringify({ success: true, awarded: results }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("evaluate-badges-for-event error", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
