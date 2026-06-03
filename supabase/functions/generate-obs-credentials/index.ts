import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGORA_APP_ID = Deno.env.get("AGORA_APP_ID") ?? "";
const AGORA_CUSTOMER_ID = Deno.env.get("AGORA_CUSTOMER_ID") ?? "";
const AGORA_CUSTOMER_SECRET = Deno.env.get("AGORA_CUSTOMER_SECRET") ?? "";
const AGORA_REGION = (Deno.env.get("AGORA_REGION") ?? "na").toLowerCase();

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function basicAuth(): string {
  const encoded = btoa(`${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`);
  return `Basic ${encoded}`;
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
    const streamId: string = body?.streamId;
    const userId: string = body?.userId;
    const regenerate: boolean = body?.regenerate ?? false;

    if (!streamId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing streamId or userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[generate-obs-credentials] env check:", {
      hasAppId: !!AGORA_APP_ID,
      appIdPrefix: AGORA_APP_ID ? AGORA_APP_ID.slice(0, 8) + "..." : "(empty)",
      hasCustomerId: !!AGORA_CUSTOMER_ID,
      customerIdPrefix: AGORA_CUSTOMER_ID ? AGORA_CUSTOMER_ID.slice(0, 8) + "..." : "(empty)",
      hasCustomerSecret: !!AGORA_CUSTOMER_SECRET,
      region: AGORA_REGION,
    });

    if (!AGORA_APP_ID || !AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
      return new Response(
        JSON.stringify({
          error: "Agora Media Gateway is not configured. Missing AGORA_APP_ID, AGORA_CUSTOMER_ID, or AGORA_CUSTOMER_SECRET.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = getSupabaseClient();

    const { data: existingStream } = await supabase
      .from("streams")
      .select("id, stream_key, agora_channel")
      .eq("id", streamId)
      .maybeSingle();

    const uid = "0";

    if (regenerate && existingStream?.stream_key) {
      const deleteUrl = `https://api.agora.io/${AGORA_REGION}/v1/projects/${AGORA_APP_ID}/rtls/ingress/streamkeys/${encodeURIComponent(existingStream.stream_key)}`;
      console.log("[generate-obs-credentials] deleting old stream key, url:", deleteUrl.replace(AGORA_APP_ID, "***"));
      await fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "Authorization": basicAuth(),
          "X-Request-ID": crypto.randomUUID(),
        },
      });
      await supabase
        .from("streams")
        .update({ stream_key: null })
        .eq("id", streamId);
    } else if (existingStream?.stream_key && !regenerate) {
      const rtmpUrl = `rtmp://rtls-ingress-prod-${AGORA_REGION}.agoramdn.com/live`;
      return new Response(
        JSON.stringify({
          ok: true,
          serverUrl: rtmpUrl,
          rtmpUrl: rtmpUrl,
          streamKey: existingStream.stream_key,
          channelName: existingStream.agora_channel,
          agoraChannel: existingStream.agora_channel,
          uid,
          expiresAt: null,
          provider: "agora-media-gateway",
          existing: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const agoraChannel = `gaming_${streamId}`;
    const ttlSeconds = 86400;

    const createUrl = `https://api.agora.io/${AGORA_REGION}/v1/projects/${AGORA_APP_ID}/rtls/ingress/streamkeys`;

    console.log("[generate-obs-credentials] create stream key:", {
      url: createUrl.replace(AGORA_APP_ID, "***"),
      region: AGORA_REGION,
      channel: agoraChannel,
      uid,
      expiresAfter: ttlSeconds,
    });

    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Authorization": basicAuth(),
        "Content-Type": "application/json",
        "X-Request-ID": crypto.randomUUID(),
      },
      body: JSON.stringify({
        settings: {
          channel: agoraChannel,
          uid,
          expiresAfter: ttlSeconds,
        },
      }),
    });

    const createBody = await createRes.json().catch(() => null);

    console.log("[generate-obs-credentials] Agora response:", {
      status: createRes.status,
      body: createBody,
    });

    if (createRes.status === 404) {
      return new Response(
        JSON.stringify({
          error: "Agora Media Gateway endpoint not found. Check REST path, region, and whether Media Gateway is enabled for this Agora project.",
          debug: {
            region: AGORA_REGION,
            channel: agoraChannel,
            uid,
          },
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (createRes.status >= 400) {
      return new Response(
        JSON.stringify({
          error: `Agora Media Gateway error ${createRes.status}`,
          agoraMessage: createBody?.message ?? null,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const streamKey = createBody?.data?.streamKey as string | undefined;
    const createdAt = createBody?.data?.createdAt as number | undefined;
    const expiresAt = createdAt && ttlSeconds > 0 ? createdAt + ttlSeconds : null;

    if (!streamKey) {
      return new Response(
        JSON.stringify({
          error: "Agora returned success but no streamKey in response",
          response: createBody,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rtmpUrl = `rtmp://rtls-ingress-prod-${AGORA_REGION}.agoramdn.com/live`;

    const { error: updateError } = await supabase
      .from("streams")
      .update({
        stream_key: streamKey,
        agora_channel: agoraChannel,
      })
      .eq("id", streamId);

    if (updateError) {
      console.error("[generate-obs-credentials] Failed to update stream:", updateError);
      const cleanupUrl = `https://api.agora.io/${AGORA_REGION}/v1/projects/${AGORA_APP_ID}/rtls/ingress/streamkeys/${encodeURIComponent(streamKey)}`;
      await fetch(cleanupUrl, {
        method: "DELETE",
        headers: {
          "Authorization": basicAuth(),
          "X-Request-ID": crypto.randomUUID(),
        },
      });
      throw updateError;
    }

    console.log("[generate-obs-credentials] success:", {
      channel: agoraChannel,
      uid,
      streamKeyPrefix: streamKey.slice(0, 8) + "...",
      expiresAt,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        serverUrl: rtmpUrl,
        rtmpUrl: rtmpUrl,
        streamKey,
        channelName: agoraChannel,
        agoraChannel: agoraChannel,
        uid,
        expiresAt,
        provider: "agora-media-gateway",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-obs-credentials] Error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown server error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
