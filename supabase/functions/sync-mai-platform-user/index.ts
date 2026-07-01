import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.28.4";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("MAITALENT_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MAITALENT_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MAITALENT_SYNC_SECRET = Deno.env.get("MAITALENT_SYNC_SECRET") || "";
const UPSTASH_REDIS_REST_URL = Deno.env.get("UPSTASH_REDIS_REST_URL") || "";
const UPSTASH_REDIS_REST_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let redis: Redis | null = null;
if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN });
  } catch (err) {
    console.error("[MaiSync] Failed to initialize Redis for idempotency", err);
  }
}

const devCache = new Map<string, number>();
const DEV_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of devCache.entries()) {
    if (expiresAt <= now) {
      devCache.delete(key);
    }
  }
}, 60_000);

interface MaiSyncPayload {
  action: "sync" | "link";
  external_platform: "troll-city";
  external_user_id: string;
  source_event_id?: string;
  activity_type?: string;
  tokens_awarded?: number;
  normalized_email: string;
  metadata?: Record<string, unknown>;
}

interface AuditRecord {
  action: string;
  target_id: string;
  user_id?: string;
  details: Record<string, unknown>;
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function hasRegisteredEvent(sourceEventId: string): Promise<boolean> {
  const cacheKey = `maitalent_sync:${sourceEventId}`;
  if (redis) {
    try {
      const existing = await redis.get(cacheKey);
      return Boolean(existing);
    } catch (err) {
      console.error("[MaiSync] Redis read failed", err);
    }
  }

  return devCache.has(cacheKey);
}

async function registerEvent(sourceEventId: string, ttlSeconds = 3600): Promise<boolean> {
  const cacheKey = `maitalent_sync:${sourceEventId}`;
  if (await hasRegisteredEvent(sourceEventId)) {
    return false;
  }

  if (redis) {
    try {
      const created = await redis.set(cacheKey, "1", { nx: true, ex: ttlSeconds });
      if (created) return true;
      return Boolean(await redis.get(cacheKey));
    } catch (err) {
      console.error("[MaiSync] Redis write failed", err);
    }
  }

  devCache.set(cacheKey, Date.now() + ttlSeconds * 1000);
  return true;
}

async function recordAudit(record: AuditRecord): Promise<void> {
  try {
    await supabase.from("audit_logs").insert([{ ...record, created_at: new Date().toISOString() }]);
  } catch (err) {
    console.error("[MaiSync] Audit log failed", err);
  }
}

async function trackTelemetry(eventType: string, details: Record<string, unknown>): Promise<void> {
  try {
    await supabase.from("telemetry_events").insert([{ event_type: eventType, message: `MaiTalent sync ${eventType}`, fingerprint: `${eventType}-${Date.now()}`, severity: "info", extra: details, created_at: new Date().toISOString() }]);
  } catch (err) {
    console.warn("[MaiSync] Telemetry insert failed", err);
  }
}

async function validatePayload(body: unknown): Promise<{ valid: true; payload: MaiSyncPayload } | { valid: false; error: string }> {
  if (!isObject(body)) {
    return { valid: false, error: "Payload must be a JSON object" };
  }

  const action = body.action;
  if (action !== "sync" && action !== "link") {
    return { valid: false, error: "Invalid action. Expected 'sync' or 'link'" };
  }

  if (body.external_platform !== "troll-city") {
    return { valid: false, error: "Invalid external_platform. Expected 'troll-city'" };
  }

  const externalUserId = typeof body.external_user_id === "string" ? body.external_user_id.trim() : "";
  if (!externalUserId) {
    return { valid: false, error: "external_user_id is required" };
  }

  const sourceEventId = typeof body.source_event_id === "string" ? body.source_event_id.trim() : "";
  if (action === "sync" && !sourceEventId) {
    return { valid: false, error: "source_event_id is required for sync" };
  }

  const normalizedEmail = normalizeEmail(body.normalized_email);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return { valid: false, error: "normalized_email must be a valid email address" };
  }

  const metadata = body.metadata;
  if (metadata !== undefined && !isObject(metadata)) {
    return { valid: false, error: "metadata must be an object when provided" };
  }

  const allowedKeys = new Set([
    "action",
    "external_platform",
    "external_user_id",
    "source_event_id",
    "normalized_email",
    "activity_type",
    "tokens_awarded",
    "metadata",
  ]);

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      return { valid: false, error: `Unknown field: ${key}` };
    }
  }

  const payload: MaiSyncPayload = {
    action,
    external_platform: "troll-city",
    external_user_id: externalUserId,
    source_event_id: sourceEventId || undefined,
    normalized_email: normalizedEmail,
    metadata: metadata as Record<string, unknown> | undefined,
  };

  if (action === "sync") {
    const tokens = Number(body.tokens_awarded);
    if (!Number.isInteger(tokens) || tokens <= 0) {
      return { valid: false, error: "tokens_awarded must be an integer greater than 0 for sync" };
    }
    const activityType = typeof body.activity_type === "string" ? body.activity_type.trim() : "";
    if (!activityType) {
      return { valid: false, error: "activity_type is required for sync" };
    }
    payload.tokens_awarded = tokens;
    payload.activity_type = activityType;
  }

  if (action === "link") {
    if (body.tokens_awarded !== undefined) {
      payload.tokens_awarded = Number(body.tokens_awarded) || 0;
    }
    if (typeof body.activity_type === "string") {
      payload.activity_type = body.activity_type.trim();
    }
  }

  return { valid: true, payload };
}

async function checkRateLimit(externalUserId: string): Promise<void> {
  try {
    const key = `maitalent_sync:${externalUserId}`;
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: 20,
      p_window_seconds: 60,
    });

    if (error) {
      console.warn("[MaiSync] rate limit RPC failed", error);
      return;
    }

    if (!data) {
      throw new Error("Rate limit exceeded");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Rate limit exceeded") {
      throw err;
    }
  }
}

async function resolveMaiUserId(payload: MaiSyncPayload): Promise<string> {
  const { data: existingLink, error: linkError } = await supabase
    .from("external_account_links")
    .select("user_id")
    .eq("external_platform", payload.external_platform)
    .eq("external_user_id", payload.external_user_id)
    .maybeSingle();

  if (linkError) {
    throw new Error("Failed to resolve external account link");
  }

  if (existingLink?.user_id) {
    return existingLink.user_id;
  }

  const { data: profileRow, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,email")
    .ilike("email", payload.normalized_email)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    throw new Error("Failed to resolve MAI user by email");
  }

  if (profileRow?.id) {
    return profileRow.id;
  }

  throw new Error("MAI user not found for external link or email");
}

async function upsertExternalAccountLink(userId: string, payload: MaiSyncPayload): Promise<void> {
  const now = new Date().toISOString();
  const row = {
    external_platform: payload.external_platform,
    external_user_id: payload.external_user_id,
    user_id: userId,
    normalized_email: payload.normalized_email,
    metadata: payload.metadata ?? null,
    updated_at: now,
    created_at: now,
  };

  const { data: existingLink, error: lookupError } = await supabase
    .from("external_account_links")
    .select("id,user_id")
    .eq("external_platform", payload.external_platform)
    .eq("external_user_id", payload.external_user_id)
    .maybeSingle();

  if (lookupError) {
    throw new Error("Failed to look up external account link");
  }

  if (existingLink) {
    const { error: updateError } = await supabase
      .from("external_account_links")
      .update({
        user_id: userId,
        normalized_email: payload.normalized_email,
        metadata: payload.metadata ?? null,
        updated_at: now,
      })
      .eq("id", existingLink.id);

    if (updateError) {
      throw new Error("Failed to update external account link");
    }
    return;
  }

  const { error: insertError } = await supabase.from("external_account_links").insert(row);
  if (insertError) {
    throw new Error("Failed to insert external account link");
  }
}

async function isDuplicateSync(payload: MaiSyncPayload): Promise<boolean> {
  if (payload.action !== "sync") return false;

  const { data, error } = await supabase
    .from("cross_platform_activity_audit")
    .select("id")
    .eq("external_platform", payload.external_platform)
    .eq("external_user_id", payload.external_user_id)
    .eq("source_event_id", payload.source_event_id)
    .eq("activity_type", payload.activity_type)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[MaiSync] duplicate check failed", error);
    return false;
  }

  return Boolean(data);
}

async function insertActivityAudit(userId: string, payload: MaiSyncPayload): Promise<void> {
  const { error } = await supabase.from("cross_platform_activity_audit").insert([
    {
      user_id: userId,
      external_platform: payload.external_platform,
      external_user_id: payload.external_user_id,
      source_event_id: payload.source_event_id,
      activity_type: payload.activity_type,
      tokens_awarded: payload.tokens_awarded ?? 0,
      normalized_email: payload.normalized_email,
      metadata: payload.metadata ?? null,
      action: payload.action,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    throw new Error("Failed to insert activity audit");
  }
}

async function insertRewardEvent(userId: string, payload: MaiSyncPayload): Promise<void> {
  if (payload.action !== "sync") return;

  const { error } = await supabase.from("cross_platform_reward_events").insert([
    {
      user_id: userId,
      external_platform: payload.external_platform,
      external_user_id: payload.external_user_id,
      source_event_id: payload.source_event_id,
      activity_type: payload.activity_type,
      tokens_awarded: payload.tokens_awarded,
      normalized_email: payload.normalized_email,
      metadata: payload.metadata ?? null,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    throw new Error("Failed to insert reward event");
  }
}

async function updateWalletAndInsertTransaction(userId: string, payload: MaiSyncPayload): Promise<{ walletId: string | null; newBalance: number }> {
  if (payload.action !== "sync") {
    return { walletId: null, newBalance: 0 };
  }

  const now = new Date().toISOString();
  const { data: existingWallet, error: walletError } = await supabase
    .from("wallets")
    .select("id,token_balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (walletError) {
    throw new Error("Failed to load wallet");
  }

  const currentBalance = Number(existingWallet?.token_balance ?? 0);
  const newBalance = currentBalance + (payload.tokens_awarded ?? 0);
  let walletId: string | null = existingWallet?.id || null;

  if (existingWallet) {
    const { error: walletUpdateError } = await supabase
      .from("wallets")
      .update({ token_balance: newBalance, updated_at: now })
      .eq("id", existingWallet.id);

    if (walletUpdateError) {
      throw new Error("Failed to update wallet balance");
    }
  } else {
    const { data: insertedWallet, error: walletInsertError } = await supabase
      .from("wallets")
      .insert([
        {
          user_id: userId,
          token_balance: newBalance,
          created_at: now,
          updated_at: now,
        },
      ])
      .select("id,token_balance")
      .maybeSingle();

    if (walletInsertError || !insertedWallet) {
      throw new Error("Failed to create wallet");
    }
    walletId = insertedWallet.id;
  }

  const { error: txError } = await supabase.from("token_transactions").insert([
    {
      user_id: userId,
      wallet_id: walletId,
      amount: payload.tokens_awarded,
      balance_after: newBalance,
      transaction_type: "cross_platform_reward",
      source: payload.external_platform,
      source_event_id: payload.source_event_id,
      activity_type: payload.activity_type,
      metadata: payload.metadata ?? null,
      created_at: now,
    },
  ]);

  if (txError) {
    throw new Error("Failed to insert token transaction");
  }

  return { walletId, newBalance };
}

async function processMaiSync(payload: MaiSyncPayload): Promise<{ userId: string; walletId: string | null; newBalance: number }> {
  const userId = await resolveMaiUserId(payload);
  await upsertExternalAccountLink(userId, payload);

  if (await isDuplicateSync(payload)) {
    throw new Error("Duplicate source_event_id or activity already processed");
  }

  await insertActivityAudit(userId, payload);
  await insertRewardEvent(userId, payload);
  const walletResult = await updateWalletAndInsertTransaction(userId, payload);

  return {
    userId,
    walletId: walletResult.walletId,
    newBalance: walletResult.newBalance,
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MAITALENT_SYNC_SECRET) {
    console.error("[MaiSync] Missing required environment configuration");
    return new Response(JSON.stringify({ success: false, error: "Server misconfiguration" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const incomingToken = req.headers.get("x-service-role") || "";
  if (incomingToken !== MAITALENT_SYNC_SECRET) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON payload" }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const validation = await validatePayload(body);
  if (!validation.valid) {
    return new Response(JSON.stringify({ success: false, error: validation.error }), {
      status: 400,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const payload = validation.payload;
  const sourceEventId = payload.source_event_id ?? `${payload.action}:${payload.external_platform}:${payload.external_user_id}`;

  try {
    await checkRateLimit(payload.external_user_id);
  } catch (err) {
    if (err instanceof Error && err.message === "Rate limit exceeded") {
      await trackTelemetry("maitalent_sync_rate_limited", { external_user_id: payload.external_user_id, source_event_id: sourceEventId });
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  }

  let registered = true;
  if (payload.action === "sync") {
    const duplicate = await hasRegisteredEvent(sourceEventId);
    if (duplicate) {
      await recordAudit({
        action: `maitalent_sync_duplicate_${payload.action}`,
        target_id: payload.external_user_id,
        details: {
          source_event_id: sourceEventId,
          normalized_email: payload.normalized_email,
          action: payload.action,
        },
      });

      await trackTelemetry("maitalent_sync_duplicate", {
        external_user_id: payload.external_user_id,
        source_event_id: sourceEventId,
        action: payload.action,
      });

      return new Response(JSON.stringify({ success: false, duplicate: true, error: "Duplicate source_event_id" }), {
        status: 409,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    registered = await registerEvent(sourceEventId);
    if (!registered) {
      return new Response(JSON.stringify({ success: false, duplicate: true, error: "Duplicate source_event_id" }), {
        status: 409,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  }

  await recordAudit({
    action: `maitalent_sync_pre_${payload.action}`,
    target_id: payload.external_user_id,
    details: {
      source_event_id: sourceEventId,
      payload,
    },
  });

  let result: unknown;
  try {
    result = await processMaiSync(payload);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await recordAudit({
      action: `maitalent_sync_failure_${payload.action}`,
      target_id: payload.external_user_id,
      details: {
        source_event_id: sourceEventId,
        payload,
        error: errorMessage,
      },
    });

    await trackTelemetry("maitalent_sync_failure", {
      external_user_id: payload.external_user_id,
      source_event_id: sourceEventId,
      action: payload.action,
      error: errorMessage,
    });

    const status = errorMessage.includes("Duplicate") ? 409 : 502;
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  await recordAudit({
    action: `maitalent_sync_success_${payload.action}`,
    target_id: payload.external_user_id,
    details: {
      source_event_id: sourceEventId,
      payload,
      result,
    },
  });

  await trackTelemetry("maitalent_sync_success", {
    external_user_id: payload.external_user_id,
    source_event_id: sourceEventId,
    action: payload.action,
    response: result,
  });

  return new Response(JSON.stringify({ success: true, data: result }), {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
});
