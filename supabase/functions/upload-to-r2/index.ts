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

const CF_R2_ACCOUNT_ID = Deno.env.get("CF_R2_ACCOUNT_ID") ?? "";
const CF_R2_ACCESS_KEY_ID = Deno.env.get("CF_R2_ACCESS_KEY_ID") ?? "";
const CF_R2_SECRET_ACCESS_KEY = Deno.env.get("CF_R2_SECRET_ACCESS_KEY") ?? "";
const CF_R2_BUCKET_NAME = Deno.env.get("CF_R2_BUCKET_NAME") ?? "broadcast-replays";
const CF_R2_PUBLIC_URL = Deno.env.get("CF_R2_PUBLIC_URL") ?? "";

const R2_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_R2_ACCOUNT_ID}/r2/buckets/${CF_R2_BUCKET_NAME}`;

function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function hmacSha256(key: Uint8Array | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = typeof key === "string" ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    data,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

async function getSignatureKey(dateStamp: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const kDate = await hmacSha256(
    encoder.encode("AWS4" + CF_R2_SECRET_ACCESS_KEY),
    dateStamp,
  );
  const kRegion = await hmacSha256(new Uint8Array(kDate), "auto");
  const kService = await hmacSha256(new Uint8Array(kRegion), "s3");
  const kSigning = await hmacSha256(new Uint8Array(kService), "aws4_request");
  return new Uint8Array(kSigning);
}

async function presignedUploadUrl(
  key: string,
  expiresIn: number = 3600,
  contentType: string = "video/mp4",
): Promise<string | null> {
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const amzDate = dateStamp + "T" + now.toISOString().slice(11, 19).replace(/:/g, "") + "Z";
  const credential = `${CF_R2_ACCESS_KEY_ID}/${dateStamp}/auto/s3/aws4_request`;
  const algorithm = "AWS4-HMAC-SHA256";

  const host = `${CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${CF_R2_BUCKET_NAME}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  });

  const canonicalRequest = [
    "PUT",
    canonicalUri,
    queryParams.toString(),
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    algorithm,
    amzDate,
    `${dateStamp}/auto/s3/aws4_request`,
    Array.from(new Uint8Array(await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonicalRequest),
    ))).map((b) => b.toString(16).padStart(2, "0")).join(""),
  ].join("\n");

  const signingKey = await getSignatureKey(dateStamp);
  const signature = Array.from(new Uint8Array(
    await hmacSha256(signingKey, stringToSign),
  )).map((b) => b.toString(16).padStart(2, "0")).join("");

  queryParams.set("X-Amz-Signature", signature);

  return `https://${host}${canonicalUri}?${queryParams.toString()}`;
}

serve(async (req: Request) => {
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
    const action = url.searchParams.get("action") ?? "getUploadUrl";

    if (action === "getUploadUrl") {
      const body = await req.json().catch(() => ({}));
      const streamId = body.streamId as string | undefined;
      const userId = body.userId as string | undefined;
      const fileName = body.fileName as string | undefined;
      const fileSize = body.fileSize as number | undefined;
      const title = body.title as string | undefined;

      if (!streamId || !userId) {
        return new Response(
          JSON.stringify({ error: "streamId and userId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );

      }

      const key = `broadcasts/${userId}/${streamId}.mp4`;

      const uploadUrl = await presignedUploadUrl(key, 7200);
      if (!uploadUrl) {
        return new Response(
          JSON.stringify({ error: "Failed to generate presigned URL" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({
        success: true,
        uploadUrl,
        key,
        publicUrl: `${CF_R2_PUBLIC_URL}/${key}`,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "confirm") {
      const body = await req.json().catch(() => ({}));
      const streamId = body.streamId as string | undefined;
      const userId = body.userId as string | undefined;
      const key = body.key as string | undefined;
      const publicUrl = body.publicUrl as string | undefined;
      const title = body.title as string | undefined;
      const durationSeconds = body.durationSeconds as number | undefined;
      const fileSize = body.fileSize as number | undefined;
      const thumbnailUrl = body.thumbnailUrl as string | undefined;

      if (!streamId || !userId || !key || !publicUrl) {
        return new Response(
          JSON.stringify({ error: "streamId, userId, key, and publicUrl required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const supabase = getSupabaseClient();

      const streamData = await supabase
        .from("streams")
        .select("title")
        .eq("id", streamId)
        .maybeSingle();

      const { error: insertError } = await supabase
        .from("broadcast_replays")
        .insert({
          stream_id: streamId,
          user_id: userId,
          title: title || streamData.data?.title || "Replay",
          cloudflare_r2_key: key,
          replay_url: publicUrl,
          thumbnail_url: thumbnailUrl || null,
          duration_seconds: durationSeconds || null,
          file_size: fileSize || null,
        });

      if (insertError) {
        console.error("[upload-to-r2] Failed to save replay metadata:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to save replay metadata", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
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
    console.error("[upload-to-r2] Error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
