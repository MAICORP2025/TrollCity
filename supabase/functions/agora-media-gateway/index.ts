import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AGORA_APP_ID = Deno.env.get("AGORA_APP_ID") ?? "";
const AGORA_APP_CERTIFICATE = Deno.env.get("AGORA_APP_CERTIFICATE") ?? "";
const AGORA_CUSTOMER_ID = Deno.env.get("AGORA_CUSTOMER_ID") ?? "";
const AGORA_CUSTOMER_SECRET = Deno.env.get("AGORA_CUSTOMER_SECRET") ?? "";
const AGORA_REGION = (Deno.env.get("AGORA_REGION") ?? "na").toLowerCase();
const AGORA_BASE_URL = Deno.env.get("AGORA_BASE_URL") ?? "https://api.agora.io";

function basicAuth(): string {
  const encoded = btoa(`${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`);
  return `Basic ${encoded}`;
}

async function agoraRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const url = `${AGORA_BASE_URL}/${AGORA_REGION}/v1/projects/${AGORA_APP_ID}${path}`;
  const headers: Record<string, string> = {
    "Authorization": basicAuth(),
    "Content-Type": "application/json",
    "X-Request-ID": crypto.randomUUID(),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function createStreamKey(
  channel: string,
  uid: string,
  ttlSeconds: number,
): Promise<{ streamKey: string; createdAt: number } | null> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAfter = ttlSeconds;

  const { status, data } = await agoraRequest("POST", `/rtls/ingress/streamkeys`, {
    settings: {
      channel,
      uid,
      expiresAfter,
    },
  });

  if (status >= 400) {
    console.error("[agora-media-gateway] createStreamKey failed:", status, JSON.stringify(data));
    return null;
  }

  const key = (data as Record<string, unknown>)?.streamKey as string | undefined;
  const createdAt = ((data as Record<string, unknown>)?.createdAt as number | undefined) ?? now;

  if (!key) {
    console.error("[agora-media-gateway] createStreamKey: no key in response:", JSON.stringify(data));
    return null;
  }

  return { streamKey: key, createdAt };
}

async function deleteStreamKey(streamKey: string): Promise<boolean> {
  const { status } = await agoraRequest("DELETE", `/rtls/ingress/streamkeys/${encodeURIComponent(streamKey)}`);
  if (status >= 400 && status !== 404) {
    console.error("[agora-media-gateway] deleteStreamKey failed:", status);
    return false;
  }
  return true;
}

async function getStreamKey(streamKey: string): Promise<unknown | null> {
  const { status, data } = await agoraRequest("GET", `/rtls/ingress/streamkeys/${encodeURIComponent(streamKey)}`);
  if (status === 404) return null;
  if (status >= 400) {
    console.error("[agora-media-gateway] getStreamKey failed:", status);
    return null;
  }
  return data;
}

async function listStreamKeys(): Promise<unknown[]> {
  const { status, data } = await agoraRequest("GET", "/rtls/ingress/streamkeys");
  if (status >= 400) {
    console.error("[agora-media-gateway] listStreamKeys failed:", status);
    return [];
  }
  return (data as unknown[]) ?? [];
}

async function getStreamHealth(streamKey: string): Promise<{ active: boolean; details: unknown }> {
  const keyData = await getStreamKey(streamKey);
  if (!keyData) {
    return { active: false, details: null };
  }

  const record = keyData as Record<string, unknown>;
  const expiresAfter = record.expiresAfter as number | undefined;
  const createdAt = record.createdAt as number | undefined;

  if (expiresAfter !== 0 && createdAt && expiresAfter) {
    const expiresAt = createdAt + expiresAfter;
    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) {
      return { active: false, details: { ...record, expired: true } };
    }
  }

  return { active: true, details: record };
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
    const action: string = body?.action;

    if (!AGORA_APP_ID || !AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
      return new Response(
        JSON.stringify({ error: "Agora REST API not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    switch (action) {
      case "createStreamKey": {
        const channel: string = body?.channel;
        const uid: string = String(body?.uid ?? "0");
        const ttlSeconds: number = body?.ttlSeconds ?? 86400;

        if (!channel) {
          return new Response(
            JSON.stringify({ error: "Missing channel" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const result = await createStreamKey(channel, uid, ttlSeconds);
        if (!result) {
          return new Response(
            JSON.stringify({ error: "Failed to create stream key via Agora REST API" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            streamKey: result.streamKey,
            createdAt: result.createdAt,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
        const streamKey: string = body?.streamKey;
        if (!streamKey) {
          return new Response(
            JSON.stringify({ error: "Missing streamKey" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const ok = await deleteStreamKey(streamKey);
        return new Response(
          JSON.stringify({ ok }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "getStreamKey": {
        const streamKey: string = body?.streamKey;
        if (!streamKey) {
          return new Response(
            JSON.stringify({ error: "Missing streamKey" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const data = await getStreamKey(streamKey);
        return new Response(
          JSON.stringify({ ok: true, data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "listStreamKeys": {
        const keys = await listStreamKeys();
        return new Response(
          JSON.stringify({ ok: true, keys }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "getStreamHealth": {
        const streamKey: string = body?.streamKey;
        if (!streamKey) {
          return new Response(
            JSON.stringify({ error: "Missing streamKey" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const health = await getStreamHealth(streamKey);
        return new Response(
          JSON.stringify({ ok: true, ...health }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${channel}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
  } catch (err) {
    console.error("[agora-media-gateway] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
