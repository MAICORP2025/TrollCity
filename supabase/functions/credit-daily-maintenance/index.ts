// Edge Function: credit-daily-maintenance
// Purpose: Daily cron to recompute trend_7d and apply inactivity penalties (placeholder)
// Runtime: Deno (Edge)

export const config = { runtime: "edge" };

import { supabase } from "../_shared/supabaseClient.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function trendFromDelta(sum7d: number): number {
  if (sum7d > 0) return 1;
  if (sum7d < 0) return -1;
  return 0;
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch recent event sums grouped by user (lightweight aggregation in JS for now)
    const { data: events, error } = await supabase
      .from("credit_events")
      .select("user_id, delta, created_at")
      .gte("created_at", windowStart);
    if (error) throw error;

    const map = new Map<string, number>();
    for (const row of events || []) {
      if (!row.user_id) continue;
      map.set(row.user_id, (map.get(row.user_id) || 0) + (row.delta ?? 0));
    }

    // Batch update trend_7d
    const updates = Array.from(map.entries()).map(([user_id, sum7d]) => ({
      user_id,
      trend_7d: trendFromDelta(sum7d),
      updated_at: new Date().toISOString(),
    }));

    // Apply updates in small batches to avoid payload limits
    const chunkSize = 200;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      const { error: upsertError } = await supabase.from("user_credit").upsert(chunk);
      if (upsertError) throw upsertError;
    }

    // TODO: Inactivity penalties can be applied here by checking last_event_at / last login

    return new Response(JSON.stringify({ success: true, updated: updates.length }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("credit-daily-maintenance error", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
