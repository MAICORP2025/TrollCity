import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL") || "";
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY") || "";
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET") || "";

async function createLiveKitToken(params: {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  participantName: string;
  isPublisher: boolean;
  canPublish: boolean;
  canSubscribe: boolean;
  exp: number;
}): Promise<string> {
  const { apiKey, apiSecret, roomName, participantName, isPublisher, canPublish, canSubscribe, exp } = params;
  const now = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();

  const header = { alg: "HS256", typ: "JWT" };
  const liveKitUrl = Deno.env.get("LIVEKIT_URL") || "wss://troll-city-llc-4ixv208d.livekit.cloud";

  const payload: any = {
    iss: apiKey,
    sub: participantName,
    aud: liveKitUrl,
    exp,
    nbf: now,
    iat: now,
    video: {
      width: 1280,
      height: 720,
    },
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const message = `${headerB64}.${payloadB64}`;

  const keyData = encoder.encode(apiSecret);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  const sigBytes = new Uint8Array(signature);
  let sigB64 = "";
  for (let i = 0; i < sigBytes.length; i++) {
    sigB64 += String.fromCharCode(sigBytes[i]);
  }
  const signatureB64 = btoa(sigB64).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${message}.${signatureB64}`;
}

async function kickLiveKitParticipant(roomName: string, identity: string, reason?: string): Promise<boolean> {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return false;

  try {
    const adminToken = await createLiveKitToken({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      roomName,
      participantName: "moderation-bot",
      isPublisher: false,
      canPublish: false,
      canSubscribe: true,
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    const response = await fetch(`${LIVEKIT_URL}/room/${encodeURIComponent(roomName)}/participant/${encodeURIComponent(identity)}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    });

    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function muteLiveKitTrack(roomName: string, identity: string): Promise<boolean> {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return false;

  try {
    const adminToken = await createLiveKitToken({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      roomName,
      participantName: "moderation-bot",
      isPublisher: false,
      canPublish: false,
      canSubscribe: true,
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    const response = await fetch(`${LIVEKIT_URL}/room/${encodeURIComponent(roomName)}/participant/${encodeURIComponent(identity)}/track/audio`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ muted: true }),
    });

    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function unmuteLiveKitTrack(roomName: string, identity: string): Promise<boolean> {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return false;

  try {
    const adminToken = await createLiveKitToken({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      roomName,
      participantName: "moderation-bot",
      isPublisher: false,
      canPublish: false,
      canSubscribe: true,
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    const response = await fetch(`${LIVEKIT_URL}/room/${encodeURIComponent(roomName)}/participant/${encodeURIComponent(identity)}/track/audio`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ muted: false }),
    });

    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

async function isAuthorizedModerator(
  supabaseAdmin: any,
  userId: string,
  streamId?: string
): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("role, is_admin, is_lead_officer, is_troll_officer, is_secretary")
    .eq("id", userId)
    .single();

  if (!profile) return false;

  const isAdmin =
    profile.is_admin === true ||
    profile.role === "admin" ||
    profile.role === "superadmin" ||
    profile.role === "ceo" ||
    profile.role === "owner" ||
    profile.is_lead_officer === true ||
    profile.role === "lead_troll_officer";

  const isSecretary = profile.role === "secretary" || profile.is_secretary === true;

  if (isAdmin || isSecretary) return true;

  if (streamId) {
    const { data: stream } = await supabaseAdmin
      .from("streams")
      .select("user_id, broadcaster_id")
      .eq("id", streamId)
      .single();

    if (stream && (stream.user_id === userId || stream.broadcaster_id === userId)) {
      return true;
    }

    const { data: modAssignment } = await supabaseAdmin
      .from("stream_moderators")
      .select("user_id")
      .eq("broadcaster_id", stream?.user_id || stream?.broadcaster_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (modAssignment) return true;
  }

  return false;
}

async function logBroadcastModAction(
  supabaseAdmin: any,
  logData: Record<string, any>,
  actorId: string,
  actorRole: string,
  actorName: string
) {
  try {
    await supabaseAdmin.from("broadcast_mod_actions").insert({
      ...logData,
      actor_id: actorId,
      actor_role: actorRole,
      actor_display_name: actorName,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[moderation-actions] Failed to log action:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req.headers.get("origin")) });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: actorProfile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !actorProfile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();
    const now = new Date().toISOString();
    const actorName = actorProfile.username || actorProfile.full_name || user.email || "Unknown";

    async function getStreamInfo(streamId: string) {
      const { data } = await supabaseAdmin
        .from("streams")
        .select("id, user_id, broadcaster_id, stream_channel, room_name, status, is_live")
        .eq("id", streamId)
        .maybeSingle();
      return data;
    }

    async function resolveTargetUser(targetUserId: string) {
      const { data } = await supabaseAdmin
        .from("user_profiles")
        .select("id, username, role, troll_role, is_admin, is_lead_officer, is_troll_officer, is_staff, is_secretary, is_prosecutor, is_attorney, is_ceo, drivers_license_status, car_insurance_expiry")
        .eq("id", targetUserId)
        .single();
      return data;
    }

    async function resolveTargetLicense(targetUserId: string) {
      const { data } = await supabaseAdmin
        .from("user_driver_licenses")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();
      return data;
    }

    let result: any = { success: false };

    switch (action) {
      case "mute": {
        const { target_user_id, stream_id, duration_minutes = 5, reason } = params;
        if (!target_user_id || !stream_id) {
          result = { success: false, error: "Missing target_user_id or stream_id" };
          break;
        }

        const authorized = await isAuthorizedModerator(supabaseAdmin, user.id, stream_id);
        if (!authorized) {
          result = { success: false, error: "Unauthorized" };
          break;
        }

        const stream = await getStreamInfo(stream_id);
        if (!stream) {
          result = { success: false, error: "Stream not found" };
          break;
        }

        const { data: muteData, error: muteError } = await supabaseAdmin.rpc("moderator_mute_user", {
          p_stream_id: stream_id,
          p_target_user_id: target_user_id,
          p_duration_minutes: duration_minutes,
          p_reason: reason || "Muted by moderator",
        });

        if (muteError || !muteData?.success) {
          result = { success: false, error: muteError?.message || muteData?.message || "Failed to mute" };
          break;
        }

        const target = await resolveTargetUser(target_user_id);
        const roomName = stream.stream_channel || stream.room_name || stream.id;
        if (target && roomName) {
          void kickLiveKitParticipant(roomName, target.username || target_user_id, "Muted by moderator").catch(() => {});
          void muteLiveKitTrack(roomName, target.username || target_user_id).catch(() => {});
        }

        await logBroadcastModAction(
          supabaseAdmin,
          {
            action_type: "mute",
            action_name: "Mute",
            target_user_id,
            target_display_name: target?.username,
            target_role_before: target?.role,
            broadcast_id: stream_id,
            livekit_room_name: roomName,
            reason: reason || "Muted by moderator",
            duration_minutes,
            new_status: "muted",
            expires_at: muteData?.expires_at,
            success: true,
          },
          user.id,
          actorProfile.role,
          actorName
        );

        result = { success: true, expires_at: muteData?.expires_at };
        break;
      }

      case "unmute": {
        const { target_user_id, stream_id } = params;
        if (!target_user_id || !stream_id) {
          result = { success: false, error: "Missing target_user_id or stream_id" };
          break;
        }

        const authorized = await isAuthorizedModerator(supabaseAdmin, user.id, stream_id);
        if (!authorized) {
          result = { success: false, error: "Unauthorized" };
          break;
        }

        const stream = await getStreamInfo(stream_id);
        if (!stream) {
          result = { success: false, error: "Stream not found" };
          break;
        }

        const { data: unmuteData, error: unmuteError } = await supabaseAdmin.rpc("moderator_unmute_user", {
          p_stream_id: stream_id,
          p_target_user_id: target_user_id,
        });

        if (unmuteError || !unmuteData?.success) {
          result = { success: false, error: unmuteError?.message || unmuteData?.message || "Failed to unmute" };
          break;
        }

        const target = await resolveTargetUser(target_user_id);
        const roomName = stream.stream_channel || stream.room_name || stream.id;
        if (target && roomName) {
          void unmuteLiveKitTrack(roomName, target.username || target_user_id).catch(() => {});
        }

        await logBroadcastModAction(
          supabaseAdmin,
          {
            action_type: "unmute",
            action_name: "Unmute",
            target_user_id,
            target_display_name: target?.username,
            target_role_before: target?.role,
            broadcast_id: stream_id,
            livekit_room_name: roomName,
            new_status: "unmuted",
            success: true,
          },
          user.id,
          actorProfile.role,
          actorName
        );

        result = { success: true };
        break;
      }

      case "disable_chat": {
        const { target_user_id, stream_id, duration_minutes = 5, reason } = params;
        if (!target_user_id || !stream_id) {
          result = { success: false, error: "Missing target_user_id or stream_id" };
          break;
        }

        const authorized = await isAuthorizedModerator(supabaseAdmin, user.id, stream_id);
        if (!authorized) {
          result = { success: false, error: "Unauthorized" };
          break;
        }

        const { data: chatData, error: chatError } = await supabaseAdmin.rpc("moderator_disable_chat", {
          p_stream_id: stream_id,
          p_target_user_id: target_user_id,
          p_duration_minutes: duration_minutes,
          p_reason: reason || "Chat disabled by moderator",
        });

        if (chatError || !chatData?.success) {
          result = { success: false, error: chatError?.message || chatData?.message || "Failed to disable chat" };
          break;
        }

        const target = await resolveTargetUser(target_user_id);
        await logBroadcastModAction(
          supabaseAdmin,
          {
            action_type: "disable_chat",
            action_name: "Disable Chat",
            target_user_id,
            target_display_name: target?.username,
            target_role_before: target?.role,
            broadcast_id: stream_id,
            reason: reason || "Chat disabled by moderator",
            duration_minutes,
            expires_at: chatData?.expires_at,
            new_status: "chat_disabled",
            success: true,
          },
          user.id,
          actorProfile.role,
          actorName
        );

        result = { success: true, expires_at: chatData?.expires_at, strike_count: chatData?.strike_count };
        break;
      }

      case "kick": {
        const { target_user_id, stream_id, reason } = params;
        if (!target_user_id || !stream_id) {
          result = { success: false, error: "Missing target_user_id or stream_id" };
          break;
        }

        const authorized = await isAuthorizedModerator(supabaseAdmin, user.id, stream_id);
        if (!authorized) {
          result = { success: false, error: "Unauthorized" };
          break;
        }

        const stream = await getStreamInfo(stream_id);
        if (!stream) {
          result = { success: false, error: "Stream not found" };
          break;
        }

        const sessionId = stream.id;

        const { data: kickData, error: kickError } = await supabaseAdmin.rpc("moderator_kick_user", {
          p_stream_id: stream_id,
          p_target_user_id: target_user_id,
          p_reason: reason || "Kicked by moderator",
        });

        if (kickError || !kickData?.success) {
          result = { success: false, error: kickError?.message || kickData?.message || "Failed to kick" };
          break;
        }

        const target = await resolveTargetUser(target_user_id);
        const roomName = stream.stream_channel || stream.room_name || stream.id;
        if (target && roomName) {
          void kickLiveKitParticipant(roomName, target.username || target_user_id, "Kicked from broadcast").catch(() => {});
        }

        await supabaseAdmin
          .from("stream_kicks")
          .update({ stream_session_id: sessionId })
          .eq("stream_id", stream_id)
          .eq("user_id", target_user_id);

        await logBroadcastModAction(
          supabaseAdmin,
          {
            action_type: "kick",
            action_name: "Kick",
            target_user_id,
            target_display_name: target?.username,
            target_role_before: target?.role,
            broadcast_id: stream_id,
            stream_session_id: sessionId,
            livekit_room_name: roomName,
            reason: reason || "Kicked by moderator",
            new_status: "kicked",
            expires_at: kickData?.expires_at,
            success: true,
          },
          user.id,
          actorProfile.role,
          actorName
        );

        result = { success: true, expires_at: kickData?.expires_at };
        break;
      }

      case "suspend_license": {
        const { target_user_id, duration_hours = 24, reason } = params;
        if (!target_user_id || !reason) {
          result = { success: false, error: "Missing target_user_id or reason" };
          break;
        }

        const target = await resolveTargetUser(target_user_id);
        if (!target) {
          result = { success: false, error: "Target user not found" };
          break;
        }

        const suspendedUntil = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString();

        const { data: licenseData, error: licenseError } = await supabaseAdmin
          .from("user_driver_licenses")
          .upsert({
            user_id: target_user_id,
            status: "suspended",
            suspended_until: suspendedUntil,
            expires_at: suspendedUntil,
            updated_at: now,
          }, { onConflict: "user_id" })
          .select()
          .single();

        if (licenseError) {
          result = { success: false, error: licenseError.message };
          break;
        }

        await supabaseAdmin
          .from("user_profiles")
          .update({ drivers_license_status: "suspended" })
          .eq("id", target_user_id);

        const broadcastCheck = await supabaseAdmin.rpc("can_user_broadcast", { p_user_id: target_user_id });

        await supabaseAdmin.from("notifications").insert({
          user_id: target_user_id,
          type: "license_suspension_started",
          title: "License Suspended",
          message: `Your driver's license has been suspended for ${duration_hours} hours. Reason: ${reason}`,
          data: { reason, duration_hours, suspendedUntil, granted_by: user.id },
        });

        await logBroadcastModAction(
          supabaseAdmin,
          {
            action_type: "suspend_license",
            action_name: "Suspend License",
            target_user_id,
            target_display_name: target.username,
            target_role_before: target.role,
            target_role_after: target.role,
            reason,
            duration_minutes: duration_hours * 60,
            previous_status: licenseData?.status || "unknown",
            new_status: "suspended",
            expires_at: suspendedUntil,
            success: true,
          },
          user.id,
          actorProfile.role,
          actorName
        );

        result = {
          success: true,
          suspendedUntil,
          can_broadcast: broadcastCheck.data?.can_broadcast ?? false,
        };
        break;
      }

      case "grant_license": {
        const { target_user_id } = params;
        if (!target_user_id) {
          result = { success: false, error: "Missing target_user_id" };
          break;
        }

        const target = await resolveTargetUser(target_user_id);
        if (!target) {
          result = { success: false, error: "Target user not found" };
          break;
        }

        const licenseExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const insuranceExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: licenseGrant, error: licenseGrantError } = await supabaseAdmin
          .from("user_driver_licenses")
          .upsert({
            user_id: target_user_id,
            status: "active",
            suspended_until: null,
            issued_at: now,
            expires_at: licenseExpiresAt,
            updated_at: now,
          }, { onConflict: "user_id" })
          .select()
          .single();

        if (licenseGrantError) {
          result = { success: false, error: licenseGrantError.message };
          break;
        }

        const { error: profileUpdateError } = await supabaseAdmin
          .from("user_profiles")
          .update({
            drivers_license_status: "active",
            drivers_license_expiry: licenseExpiresAt,
            car_insurance_expiry: insuranceExpiresAt,
          })
          .eq("id", target_user_id);

        if (profileUpdateError) {
          console.error("[moderation-actions] Profile update error:", profileUpdateError);
        }

        const { error: insuranceError } = await supabaseAdmin
          .from("user_insurances")
          .upsert({
            user_id: target_user_id,
            protection_type: "car",
            is_active: true,
            expires_at: insuranceExpiresAt,
            issued_at: now,
          }, { onConflict: "user_id,protection_type" });

        if (insuranceError) {
          console.error("[moderation-actions] Insurance insert error:", insuranceError);
        }

        const broadcastCheck = await supabaseAdmin.rpc("can_user_broadcast", { p_user_id: target_user_id });

        await supabaseAdmin.from("notifications").insert({
          user_id: target_user_id,
          type: "license_granted",
          title: "Driver License Granted",
          message: "Your driver license and 30 days of car insurance have been granted by moderators. You can now broadcast and go live.",
          data: { granted_by: user.id, license_expires_at: licenseExpiresAt, insurance_expires_at: insuranceExpiresAt },
        });

        await logBroadcastModAction(
          supabaseAdmin,
          {
            action_type: "grant_license",
            action_name: "Grant License",
            target_user_id,
            target_display_name: target.username,
            target_role_before: target.role,
            target_role_after: target.role,
            previous_status: "none",
            new_status: "active",
            expires_at: licenseExpiresAt,
            success: true,
          },
          user.id,
          actorProfile.role,
          actorName
        );

        result = {
          success: true,
          license_expires_at: licenseExpiresAt,
          insurance_expires_at: insuranceExpiresAt,
          can_broadcast: broadcastCheck.data?.can_broadcast ?? false,
        };
        break;
      }

      case "remove_officer": {
        const { target_user_id, stream_id } = params;
        if (!target_user_id || !stream_id) {
          result = { success: false, error: "Missing target_user_id or stream_id" };
          break;
        }

        const stream = await getStreamInfo(stream_id);
        if (!stream) {
          result = { success: false, error: "Stream not found" };
          break;
        }

        const isStreamOwner = stream.user_id === user.id || stream.broadcaster_id === user.id;
        const isAdmin = actorProfile.role === "admin" || actorProfile.is_admin === true;
        if (!isStreamOwner && !isAdmin) {
          result = { success: false, error: "Only stream owner or admin can remove officers" };
          break;
        }

        const { data: removeData, error: removeError } = await supabaseAdmin.rpc("remove_stream_broadofficer", {
          p_stream_id: stream_id,
          p_officer_id: target_user_id,
        });

        if (removeError) {
          result = { success: false, error: removeError.message };
          break;
        }

        const target = await resolveTargetUser(target_user_id);
        await logBroadcastModAction(
          supabaseAdmin,
          {
            action_type: "remove_officer",
            action_name: "Remove Officer",
            target_user_id,
            target_display_name: target?.username,
            target_role_before: target?.role,
            target_role_after: target?.role,
            broadcast_id: stream_id,
            new_status: "officer_removed",
            success: removeData?.removed ?? true,
          },
          user.id,
          actorProfile.role,
          actorName
        );

        result = { success: true, removed: removeData?.removed ?? true };
        break;
      }

      case "set_to_user": {
        const { target_user_id } = params;
        if (!target_user_id) {
          result = { success: false, error: "Missing target_user_id" };
          break;
        }

        const authCheck = await supabaseAdmin.rpc("can_set_to_user", {
          p_actor_id: user.id,
          p_target_id: target_user_id,
        });

        if (authCheck.error || !authCheck.data?.allowed) {
          result = { success: false, error: authCheck.error?.message || authCheck.data?.reason || "Unauthorized" };
          break;
        }

        const target = await resolveTargetUser(target_user_id);
        const previousRole = target?.role;

        const { error: resetError } = await supabaseAdmin.rpc("reset_user_permissions", {
          p_target_user_id: target_user_id,
        });

        if (resetError) {
          result = { success: false, error: resetError.message };
          break;
        }

        await supabaseAdmin
          .from("user_profiles")
          .update({
            role: "user",
            troll_role: null,
            is_admin: false,
            is_troll_officer: false,
            is_lead_officer: false,
            is_prosecutor: false,
            is_attorney: false,
            is_secretary: false,
            is_staff: false,
            updated_at: now,
          })
          .eq("id", target_user_id);

        await logBroadcastModAction(
          supabaseAdmin,
          {
            action_type: "set_to_user",
            action_name: "Set to User",
            target_user_id,
            target_display_name: target?.username,
            target_role_before: previousRole,
            target_role_after: "user",
            previous_status: previousRole,
            new_status: "user",
            success: true,
          },
          user.id,
          actorProfile.role,
          actorName
        );

        result = { success: true };
        break;
      }

      case "end_stream": {
        const { target_user_id, stream_id, reason, restrict_duration_minutes = 60 } = params;

        let streamToEnd = stream_id;
        let streamData: any = null;

        if (!streamToEnd && target_user_id) {
          const { data: activeStream } = await supabaseAdmin
            .from("streams")
            .select("id, user_id, broadcaster_id, status, is_live, stream_channel")
            .or(`user_id.eq.${target_user_id},broadcaster_id.eq.${target_user_id}`)
            .or("is_live.eq.true,status.eq.live,status.eq.active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          streamData = activeStream;
          streamToEnd = activeStream?.id || "";
        } else {
          streamData = await getStreamInfo(streamToEnd);
        }

        if (!streamToEnd || !streamData) {
          result = { success: false, error: "No active stream found to end" };
          break;
        }

        const isStreamOwner = streamData.user_id === user.id || streamData.broadcaster_id === user.id;
        const isAdmin = actorProfile.role === "admin" || actorProfile.is_admin === true;
        if (!isStreamOwner && !isAdmin) {
          result = { success: false, error: "Only stream owner or admin can end this stream" };
          break;
        }

        const { error: updateError } = await supabaseAdmin
          .from("streams")
          .update({
            status: "ended",
            is_live: false,
            ended_at: now,
            end_time: now,
            is_force_ended: true,
            ended_by: user.id,
            updated_at: now,
          })
          .eq("id", streamToEnd);

        if (updateError) {
          result = { success: false, error: updateError.message };
          break;
        }

        const restrictUntil = new Date(Date.now() + restrict_duration_minutes * 60 * 1000).toISOString();
        await supabaseAdmin.from("broadcast_restrictions").insert({
          user_id: streamData.user_id,
          restricted_by: user.id,
          reason: reason || "Ended by moderator",
          duration_minutes: restrict_duration_minutes,
          expires_at: restrictUntil,
        });

        const roomName = streamData.stream_channel || streamData.room_name || streamToEnd;
        if (roomName) {
          await supabaseAdmin.from("stream_participants").delete().eq("stream_id", streamToEnd);
        }

        await logBroadcastModAction(
          supabaseAdmin,
          {
            action_type: "end_stream",
            action_name: "End Stream",
            target_user_id: streamData.user_id,
            broadcast_id: streamToEnd,
            livekit_room_name: roomName,
            reason: reason || "Ended by moderator",
            duration_minutes: restrict_duration_minutes,
            new_status: "ended",
            expires_at: restrictUntil,
            success: true,
          },
          user.id,
          actorProfile.role,
          actorName
        );

        result = { success: true, stream_id: streamToEnd, restricted_until: restrictUntil };
        break;
      }

      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[moderation-actions] Error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});
