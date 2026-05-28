import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@^2.0.5";

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
  "lead_troll_officer",
  "secretary",
  "president",
  "agency_hr",
  "agency_hr_manager",
  "hr",
  "hr_manager",
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

  try {
    const body = (await req.json().catch(() => ({}))) as TokenRequestBody;

    const channelName = String(body.channelName || "staff-walkie-talkie").trim();

    const rawUserId =
      body.userId ||
      body.user_id ||
      body.uid ||
      body.username ||
      crypto.randomUUID();

    const uid = stableNumericUid(rawUserId);

    const role = String(body.role || body.metadata?.role || "")
      .trim()
      .toLowerCase();

    if (role && !ALLOWED_ROLES.has(role)) {
      return withCors(
        {
          error: "Your role cannot access Staff Walkie Talkie.",
          code: "ROLE_DENIED",
          role,
        },
        403,
        req,
      );
    }

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
      channelName,
      uid,
      role: role || "unverified",
      privilegeExpiredTs,
      expiresAt,
    });

    const token = generateAgoraToken({
      appId,
      appCertificate,
      channelName,
      uid,
      role: "publisher",
      privilegeExpiredTs,
    });

    console.log("[agora-walkie-token] ✅ Token generated successfully");

    return withCors(
      {
        token,
        appId,
        channelName,
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