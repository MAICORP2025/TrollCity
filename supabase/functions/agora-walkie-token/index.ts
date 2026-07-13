import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@^2.0.5";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const authSupabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Reject unauthenticated callers. Returns the authenticated user or a 401 Response. */
async function requireAuth(req: Request): Promise<{ user: { id: string } | null; error: Response | null }> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return { user: null, error: withCors({ error: "Missing authorization token" }, 401, req) };
  }
  const { data: { user }, error: authError } = await authSupabase.auth.getUser(token);
  if (authError || !user) {
    return { user: null, error: withCors({ error: "Unauthorized" }, 401, req) };
  }
  return { user: { id: user.id }, error: null };
}

/**
 * Agora Walkie-Talkie Token Generator
 * Generates RTC tokens for staff walkie-talkie channel.
 *
 * Frontend must join with:
 * await client.join(data.appId, data.channelName, data.token, data.uid)
 */

type TokenRequestBody = {
  channelName?: string;
  userId?: string | number;
  user_id?: string | number;
  uid?: string | number;
  role?: string;
  username?: string;
  metadata?: {
    role?: string;
    [key: string]: unknown;
  };
};

const ALLOWED_ROLES = new Set([
  "admin",
  "ceo",
  "staff",
  "officer",
  "broadofficer",
  "troll_officer",
  "lead_troll_officer",
  "secretary",
  "president",
  "agency_hr",
  "agency_hr_manager",
  "agency_leader",
  "attorney",
  "prosecutor",
  "journalist",
  "tcnn_news_caster",
  "tcnn_chief_news_caster",
  "auctioneer",
  "pastor",
  "org_admin",
  "empire_partner",
  "troller",
  "ceo_assistant",
  "noah_assistant",
  "hr",
  "hr_manager",
  "moderator",
  "superadmin",
  "troll_family_leader",
  "noah_admin",
  "family_leader",
  "broadcaster",
  "org_student",
  "student",
]);

function stableNumericUid(value: unknown): number {
  const raw = String(value || "").trim();

  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }

  const uid = hash % 2147483647;
  return uid > 0 ? uid : 1;
}

function generateAgoraToken(params: {
  appId: string;
  appCertificate: string;
  channelName: string;
  uid: number;
  role?: "publisher" | "subscriber";
  privilegeExpiredTs: number;
}): string {
  const {
    appId,
    appCertificate,
    channelName,
    uid,
    role = "publisher",
    privilegeExpiredTs,
  } = params;

  const agoraRole =
    role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    agoraRole,
    privilegeExpiredTs,
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflight(req);
  }

  if (req.method !== "POST") {
    return withCors({ error: "Method not allowed" }, 405, req);
  }

  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    return authError ?? withCors({ error: "Unauthorized" }, 401, req);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as TokenRequestBody;

    // Verify the caller's role from the database, never trust client-supplied role.
    const { data: profile } = await authSupabase
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const dbRole = String(profile?.role || (profile?.is_admin ? "admin" : ""))
      .trim()
      .toLowerCase();

    if (dbRole && !ALLOWED_ROLES.has(dbRole)) {
      return withCors(
        {
          error: "Your role cannot access Staff Walkie Talkie.",
          code: "ROLE_DENIED",
          role: dbRole,
        },
        403,
        req,
      );
    }

    const channelName = String(body.channelName || "staff-walkie-talkie").trim();
    const pageNum = Number(body.walkieTalkiePage || body.walkie_talkie_page || 0) || 0;
    const pageSuffix = pageNum > 0 ? `-page${pageNum}` : "";
    const fullChannelName = `${channelName}${pageSuffix}`;

    // Tie the token to the authenticated user so it cannot be reused by others.
    const uid = stableNumericUid(user.id);

    const appId =
      Deno.env.get("AGORA_APP_ID") ||
      Deno.env.get("VITE_AGORA_APP_ID");

    const appCertificate =
      Deno.env.get("AGORA_APP_CERTIFICATE") ||
      Deno.env.get("VITE_AGORA_APP_CERTIFICATE");

    if (!appId || !appCertificate) {
      console.error("[agora-walkie-token] Agora credentials NOT configured:", {
        hasAppId: Boolean(appId),
        hasCertificate: Boolean(appCertificate),
      });

      return withCors(
        {
          error: "Agora credentials not configured",
          hint: "Set AGORA_APP_ID and AGORA_APP_CERTIFICATE in Supabase secrets.",
        },
        500,
        req,
      );
    }

    const expireSeconds = 60 * 60;
    const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expireSeconds;
    const expiresAt = new Date(privilegeExpiredTs * 1000).toISOString();

    console.log("[agora-walkie-token] Generating token", {
      channelName: fullChannelName,
      uid,
      role: dbRole || "unverified",
      page: pageNum || "default",
      privilegeExpiredTs,
      expiresAt,
    });

    const token = generateAgoraToken({
      appId,
      appCertificate,
      channelName: fullChannelName,
      uid,
      role: "publisher",
      privilegeExpiredTs,
    });

    console.log("[agora-walkie-token] ✅ Token generated successfully");

    return withCors(
      {
        token,
        appId,
        channelName: fullChannelName,
        uid,
        expiresAt,
        privilegeExpiredTs,
      },
      200,
      req,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error("[agora-walkie-token] ❌ Error:", message);

    return withCors(
      {
        error: "Failed to generate token",
        details: message,
      },
      500,
      req,
    );
  }
});