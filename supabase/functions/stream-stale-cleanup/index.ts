import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// A broadcast auto-ends after this many minutes with NO chat and NO gifts.
// Staff/admin broadcasts are exempt (enforced inside auto_end_inactive_streams).
// This must be kept in sync with the pg_cron schedule.
const INACTIVITY_MINUTES = 3;

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const inactivityMinutes: number =
      Number(body?.inactivityMinutes) || INACTIVITY_MINUTES;

    const supabase = getSupabaseClient();

    // End streams that have had no chat/gift activity for `inactivityMinutes`.
    // Staff/admin broadcasts and freshly-started streams (grace window) are
    // excluded inside the RPC.
    const { data: ended, error } = await supabase.rpc(
      "auto_end_inactive_streams",
      { inactivity_minutes: inactivityMinutes },
    );

    if (error) throw error;

    const endedList = (ended || []) as Array<{
      ended_stream_id: string;
      broadcaster_id: string | null;
      last_activity: string | null;
    }>;

    // Fan out a realtime broadcast_ended event for each cleaned-up stream so the
    // RTC Admin Monitor removes it from the active list immediately (in addition
    // to the postgres_changes UPDATE that the monitor also listens for).
    for (const row of endedList) {
      try {
        await supabase.channel("rtc-admin-monitor").send({
          type: "broadcast",
          event: "broadcast_ended",
          payload: {
            stream_id: row.ended_stream_id,
            broadcaster_id: row.broadcaster_id,
            ended_at: new Date().toISOString(),
            reason: "auto",
          },
        });
      } catch (broadcastErr) {
        console.warn(
          `[stream-stale-cleanup] broadcast_ended failed for ${row.ended_stream_id}:`,
          broadcastErr,
        );
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        cleanedUp: endedList.length,
        streamIds: endedList.map((r) => r.ended_stream_id),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[stream-stale-cleanup] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
