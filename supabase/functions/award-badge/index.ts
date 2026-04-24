// Edge Function: award-badge
// Purpose: Idempotently award a badge to a user by slug
// Runtime: Deno (Edge)

export const config = { runtime: "edge" };

import { awardBadge } from "../_shared/badges.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  try {
    const body = await req.json();
    const { user_id, badge_slug, metadata = {} } = body || {};

    if (!user_id || !badge_slug) {
      return new Response(JSON.stringify({ error: "user_id and badge_slug are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const result = await awardBadge({ userId: user_id, badgeSlug: badge_slug, metadata });

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("award-badge error", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
