import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";
import { corsHeaders } from "../_shared/cors.ts";

const handlerId = "supabase-edge-livekit-token-v2";

type TokenRequest = {
  room?: string;
  identity?: string;
  role?: "host" | "guest" | string;
};

function withHeaders(
  origin: string | null,
  status: number,
  body: Record<string, unknown>,
  livekitHost?: string | null
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
      "X-LiveKit-Handler": handlerId,
      "X-LiveKit-Host": livekitHost ?? "",
    },
  });
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        ...corsHeaders(origin),
        "X-LiveKit-Handler": handlerId,
        "X-LiveKit-Host": "",
      },
    });
  }

  if (req.method !== "POST") {
    return withHeaders(origin, 405, { error: "Method Not Allowed" });
  }

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return withHeaders(origin, 401, { error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return withHeaders(origin, 500, { error: "Server misconfigured" });
  }

  let body: TokenRequest;
  try {
    body = (await req.json()) as TokenRequest;
  } catch {
    return withHeaders(origin, 400, { error: "Invalid JSON" });
  }

  const missing: string[] = [];
  if (!body.room) missing.push("room");
  if (!body.identity) missing.push("identity");
  if (!body.role) missing.push("role");

  if (missing.length) {
    return withHeaders(origin, 400, { error: "Missing fields", missing });
  }

  const room = body.room as string;
  const identity = body.identity as string;
  const role = body.role === "host" || body.role === "guest" ? body.role : null;
  if (!role) {
    return withHeaders(origin, 400, { error: "Invalid role" });
  }

  const token = authHeader.replace("Bearer ", "").trim();
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return withHeaders(origin, 401, { error: "Unauthorized" });
  }

  const livekitUrl = Deno.env.get("LIVEKIT_URL");
  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

  console.log("LiveKit Host:", livekitUrl);
  console.log("Key exists:", !!apiKey);
  console.log("Secret exists:", !!apiSecret);

  const missingEnv: string[] = [];
  if (!livekitUrl) missingEnv.push("LIVEKIT_URL");
  if (!apiKey) missingEnv.push("LIVEKIT_API_KEY");
  if (!apiSecret) missingEnv.push("LIVEKIT_API_SECRET");

  if (missingEnv.length) {
    return withHeaders(origin, 500, { error: "LiveKit not configured", missing: missingEnv }, livekitUrl);
  }

  const canPublish = role === "host";
  const at = new AccessToken(apiKey as string, apiSecret as string, { identity });
  at.addGrant({
    room,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
  });

  const jwt = await at.toJwt();
  return withHeaders(origin, 200, { token: jwt, url: livekitUrl }, livekitUrl);
});
