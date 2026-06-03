import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Cloudflare Stream API credentials
const CF_ACCOUNT_ID = Deno.env.get("CF_ACCOUNT_ID") ?? "";
const CF_STREAM_API_TOKEN = Deno.env.get("CF_STREAM_API_TOKEN") ?? "";
const CF_STREAM_CUSTOMER_CODE = Deno.env.get("CF_STREAM_CUSTOMER_CODE") ?? ""; // optional, for signed URLs

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CF_STREAM_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream`;

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Upload a recording to Cloudflare Stream.
 *
 * Two modes:
 * 1. Direct upload (TUS) — for large files, returns an upload URL for the client
 * 2. Direct creator upload — for smaller files, accepts the file in the request
 *
 * This function handles mode 2: receives the video blob via multipart/form-data,
 * uploads it to Cloudflare Stream, and updates the streams table with the
 * cloudflare_recording_id and cloudflare_playback_url.
 */
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "upload";

    // ─── Get upload URL (TUS) ──────────────────────────────────────
    if (action === "getUploadUrl") {
      const body = await req.json().catch(() => ({}));
      const streamId = body.streamId as string | undefined;
      const fileName = body.fileName as string | undefined;
      const fileSize = body.fileSize as number | undefined;

      if (!streamId) {
        return new Response(JSON.stringify({ error: "streamId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create a direct creator upload session
      const cfRes = await fetch(`${CF_STREAM_BASE}/direct_upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CF_STREAM_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxDurationSeconds: 7200, // 2 hours max
          expiry: new Date(Date.now() + 3600 * 1000).toISOString(), // 1 hour
          meta: {
            streamId: streamId,
            fileName: fileName ?? `gaming_${streamId}.webm`,
            source: "hytrogaming",
          },
        }),
      });

      if (!cfRes.ok) {
        const errText = await cfRes.text();
        console.error("[upload-to-cloudflare-stream] CF direct_upload failed:", cfRes.status, errText);
        return new Response(JSON.stringify({ error: "Cloudflare upload session failed", details: errText }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cfData = await cfRes.json();

      if (!cfData.success) {
        return new Response(JSON.stringify({ error: "Cloudflare API error", details: cfData.errors }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const uploadURL = cfData.result?.uploadURL as string | undefined;
      const uid = cfData.result?.uid as string | undefined;

      if (!uploadURL || !uid) {
        return new Response(JSON.stringify({ error: "Cloudflare response missing uploadURL or uid" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Store the cloudflare_recording_id in streams table
      const supabase = getSupabaseClient();
      await supabase
        .from("streams")
        .update({ cloudflare_recording_id: uid })
        .eq("id", streamId);

      return new Response(JSON.stringify({
        success: true,
        uploadURL,
        uid,
        playbackUrl: `https://cloudflarestream.com/${uid}/manifest/video.mpd`,
        iframeSrc: `https://cloudflarestream.com/${uid}/iframe`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Confirm upload complete & get playback URL ─────────────────
    if (action === "confirm") {
      const body = await req.json().catch(() => ({}));
      const streamId = body.streamId as string | undefined;
      const uid = body.uid as string | undefined;

      if (!streamId || !uid) {
        return new Response(JSON.stringify({ error: "streamId and uid required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check the video status on Cloudflare
      const cfRes = await fetch(`${CF_STREAM_BASE}/${uid}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${CF_STREAM_API_TOKEN}`,
        },
      });

      if (!cfRes.ok) {
        const errText = await cfRes.text();
        console.error("[upload-to-cloudflare-stream] CF get video failed:", cfRes.status, errText);
        return new Response(JSON.stringify({ error: "Failed to check video status", details: errText }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cfData = await cfRes.json();
      const playbackUrl = `https://cloudflarestream.com/${uid}/manifest/video.mpd`;
      const thumbnailUrl = `https://cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;

      // Update streams table with playback URL
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("streams")
        .update({
          cloudflare_playback_url: playbackUrl,
          cloudflare_recording_id: uid,
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", streamId);

      if (updateError) {
        console.error("[upload-to-cloudflare-stream] Failed to update streams:", updateError);
      }

      // Auto-save to saved_streams for the broadcaster
      const { data: streamData } = await supabase
        .from("streams")
        .select("user_id")
        .eq("id", streamId)
        .maybeSingle();

      if (streamData?.user_id) {
        await supabase
          .from("saved_streams")
          .upsert({
            user_id: streamData.user_id,
            stream_id: streamId,
            source: "gaming_recording",
          }, { onConflict: "user_id,stream_id" });
      }

      return new Response(JSON.stringify({
        success: true,
        uid,
        playbackUrl,
        thumbnailUrl,
        status: cfData.result?.status?.state ?? "unknown",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Delete a recording ─────────────────────────────────────────
    if (action === "delete") {
      const body = await req.json().catch(() => ({}));
      const uid = body.uid as string | undefined;

      if (!uid) {
        return new Response(JSON.stringify({ error: "uid required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cfRes = await fetch(`${CF_STREAM_BASE}/${uid}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${CF_STREAM_API_TOKEN}`,
        },
      });

      if (!cfRes.ok) {
        const errText = await cfRes.text();
        console.error("[upload-to-cloudflare-stream] CF delete failed:", cfRes.status, errText);
        return new Response(JSON.stringify({ error: "Failed to delete recording", details: errText }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[upload-to-cloudflare-stream] Error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
