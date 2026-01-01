import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
console.log("✅ LIVEKIT TOKEN DEPLOY MARKER v113 - " + new Date().toISOString());

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface AuthorizedProfile {
  id: string;
  username: string;
  role: string;
  avatar_url?: string | null;
  is_broadcaster?: boolean;
  is_admin?: boolean;
  is_lead_officer?: boolean;
  is_troll_officer?: boolean;
}

interface TokenRequestParams {
  room?: string;
  roomName?: string;
  identity?: string;
  allowPublish?: boolean | string;
  level?: string | number;
  role?: string;
}

// ✅ Lazy imports so OPTIONS is instant
async function getSupabase() {
  const mod = await import("@supabase/supabase-js");
  return mod;
}

async function getLivekit() {
  const mod = await import("livekit-server-sdk");
  return mod;
}

async function authorizeUser(req: Request): Promise<AuthorizedProfile> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    console.error("[authorizeUser] Missing or invalid authorization header");
    throw new Error("Missing authorization header");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error("[authorizeUser] Missing Supabase environment variables");
    throw new Error("Server configuration error");
  }

  const { createClient } = await getSupabase();

  // Use anon + user JWT to validate session
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  console.log("[authorizeUser] Validating user session...");
  
  // First check if we have a valid session
  const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession();
  
  if (sessionError) {
    console.error("[authorizeUser] Session error:", sessionError.message);
    throw new Error("Session validation failed");
  }
  
  if (!session) {
    console.error("[authorizeUser] No active session found");
    throw new Error("No active session. Please sign in again.");
  }
  
  // Check if session is expired
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at < now) {
    console.error("[authorizeUser] Session expired:", {
      expiresAt: session.expires_at,
      now: now,
      timeDiff: session.expires_at - now
    });
    throw new Error("Session expired. Please sign in again.");
  }

  // Now get the user
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError) {
    console.error("[authorizeUser] User validation error:", userError.message);
    if (userError.message.includes('Invalid JWT') || userError.message.includes('expired')) {
      throw new Error("Session expired. Please sign in again.");
    }
    throw new Error("Unable to verify user session");
  }
  
  if (!user) {
    console.error("[authorizeUser] No user found in session");
    throw new Error("Invalid session. Please sign in again.");
  }
  
  console.log("[authorizeUser] Session validated for user:", user.id);

  // Use service role to read profile without RLS headaches
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select("id, username, role, avatar_url, is_broadcaster, is_admin, is_lead_officer, is_troll_officer")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("[authorizeUser] Profile fetch error:", profileError.message);
    throw new Error("Unable to load user profile");
  }
  
  if (!profile) {
    console.error("[authorizeUser] No profile found for user:", user.id);
    throw new Error("User profile not found");
  }

  console.log("[authorizeUser] Profile loaded for user:", profile.username);
  return profile as AuthorizedProfile;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const t0 = performance.now();

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = await authorizeUser(req);

    const params: TokenRequestParams =
      req.method === "POST"
        ? await req.json() as TokenRequestParams
        : Object.fromEntries(new URL(req.url).searchParams) as TokenRequestParams;

    const room = params.room || params.roomName;

    // ✅ Fix identity: never allow "null" string to pass through
    const rawIdentity = params.identity;
    const identity =
      rawIdentity && rawIdentity !== "null" && rawIdentity !== null
        ? rawIdentity
        : profile.id;

    // ✅ FIX allowPublish parsing ("1" also counts)
    const allowPublish =
      params.allowPublish === true ||
      params.allowPublish === "true" ||
      params.allowPublish === "1";

    const level = params.level;

    if (!room) {
      return new Response(JSON.stringify({ error: "Missing room" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const livekitUrl = Deno.env.get("LIVEKIT_URL");

    if (!apiKey || !apiSecret || !livekitUrl) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ✅ FIX role matching — allow publisher as well
    let canPublish = Boolean(allowPublish);
    const roleParam = String(params.role || "").toLowerCase();

    if (roleParam === "broadcaster" || roleParam === "publisher" || roleParam === "admin") {
      canPublish = true;
    }
    if (profile?.is_broadcaster || profile?.is_admin) canPublish = true;

    console.log("[livekit-token] params:", {
      room,
      identity,
      roleParam,
      allowPublish,
      canPublish,
      level,
    });

    const metadata = {
      user_id: profile.id,
      username: profile.username,
      role: profile.role,
      avatar_url: profile.avatar_url,
      level: Number(level ?? 1),
    };

    const { AccessToken, TrackSource } = await getLivekit();

    const token = new AccessToken(apiKey, apiSecret, {
      identity: String(identity),
      name: profile.username,
      ttl: 60 * 60,
      metadata: JSON.stringify(metadata),
    });

    token.addGrant({
      room: String(room),
      roomJoin: true,
      canSubscribe: true,
      canPublish,
      canPublishData: canPublish,
      canUpdateOwnMetadata: true,
      canPublishSources: canPublish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
    });

    const jwt = await token.toJwt();

    const ms = Math.round(performance.now() - t0);
    console.log(`[livekit-token] ok room=${room} user=${profile.id} publish=${canPublish} ${ms}ms`);

    return new Response(
      JSON.stringify({
        token: jwt,
        livekitUrl,
        url: livekitUrl,
        room,
        identity: String(identity),
        allowPublish: canPublish,
        publishAllowed: canPublish,
        roleParam,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const ms = Math.round(performance.now() - t0);
    console.error("[livekit-token] error", err?.message || err, `${ms}ms`);

    const status = String(err?.message || "").includes("Unauthorized") ? 403 : 500;
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
