// supabase/functions/livekit-webhooks/index.ts
// LiveKit webhook handler - protects battle streams from premature ending
// Handles webhook events from LiveKit (room_finished, etc.)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withCors, handleCorsPreflight } from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

// Optional: LiveKit webhook secret for signature verification
const LIVEKIT_WEBHOOK_SECRET = Deno.env.get("LIVEKIT_WEBHOOK_SECRET");

// Helper: verify LiveKit webhook signature
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!LIVEKIT_WEBHOOK_SECRET || !signatureHeader) {
    return true; // Skip verification if secret not set or header missing
  }

  // LiveKit uses HMAC-SHA256 with the secret
  const encoder = new TextEncoder();
  const keyData = encoder.encode(LIVEKIT_WEBHOOK_SECRET);
  const cryptoKey = crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const message = encoder.encode(rawBody);
  const signatureArray = crypto.subtle.sign('HMAC', cryptoKey, message);
  const signature = Array.from(new Uint8Array(signatureArray))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // LiveKit sends signature as hex string
  // Header format may be just the hex digest
  const expected = signature.toLowerCase();
  const received = signatureHeader.toLowerCase();

  return expected === received;
}

// Helper: check if battle is active
async function isBattleActive(battleId: string): Promise<boolean> {
  const { data } = await supabase
    .from("battles")
    .select("status")
    .eq("id", battleId)
    .single();

  return data?.status === 'pending' || data?.status === 'active';
}

// Helper: end a stream (non-battle safe ending)
async function endStream(streamId: string): Promise<boolean> {
  try {
    // Update stream
    const { error: streamError } = await supabase
      .from("streams")
      .update({
        is_live: false,
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq("id", streamId);

    if (streamError) {
      console.error(`❌ Failed to end stream ${streamId}:`, streamError.message);
      return false;
    }

    // Deactivate participants
    await supabase
      .from("streams_participants")
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq("stream_id", streamId)
      .eq("is_active", true);

    console.log(`✅ Stream ${streamId} ended successfully`);
    return true;
  } catch (err) {
    console.error(`❌ Error ending stream ${streamId}:`, err);
    return false;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const requestId = `livekit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[LiveKitWebhook ${requestId}] Request received`);

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req);
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405, req);
  }

  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('LiveKit-Signature') || req.headers.get('X-LiveKit-Signature');

    // Verify webhook signature if secret is configured
    if (!verifySignature(rawBody, signatureHeader)) {
      console.error(`[LiveKitWebhook ${requestId}] Invalid signature`);
      return withCors({ success: false, error: 'Invalid signature' }, 401, req);
    }

    const body = JSON.parse(rawBody);
    const event = body.event || body.type;
    const room = body.room || {};
    const roomName = room.name || room.id;

    console.log(`[LiveKitWebhook ${requestId}] Event: ${event}, Room: ${roomName}`);

    // Handle room_finished event
    if (event === 'room_finished') {
      // Battle room detection: room names starting with "battle-"
      if (roomName && roomName.startsWith('battle-')) {
        const battleId = roomName.substring('battle-'.length);

        console.log(`[LiveKitWebhook ${requestId}] 🛡️ BATTLE ROOM DETECTED: ${roomName} (battleId: ${battleId})`);

        // Check if battle exists and is active/pending
        const battleActive = await isBattleActive(battleId);
        if (battleActive) {
          console.log(`[LiveKitWebhook ${requestId}] 🛡️ IGNORING room_finished for active battle room: ${roomName}`);
          return withCors({
            success: true,
            message: 'Battle room event ignored - active battle in progress',
            ignored: true,
            room: roomName,
            battle_id: battleId
          }, 200, req);
        } else {
          console.log(`[LiveKitWebhook ${requestId}] ℹ️ Battle room ${roomName} but battle is not active (status ended/not found). Still ignoring.`);
          return withCors({
            success: true,
            message: 'Battle room event ignored - battle not active',
            ignored: true,
            room: roomName,
            battle_id: battleId
          }, 200, req);
        }
      }

      // Regular stream room - check if it's part of an active battle
      if (roomName) {
        console.log(`[LiveKitWebhook ${requestId}] Checking stream: ${roomName}`);

        const { data: stream } = await supabase
          .from("streams")
          .select("id, battle_id")
          .eq("id", roomName)
          .single();

        if (stream?.battle_id) {
          console.log(`[LiveKitWebhook ${requestId}] Stream ${roomName} is in battle: ${stream.battle_id}`);

          const battleActive = await isBattleActive(stream.battle_id);
          if (battleActive) {
            console.log(`[LiveKitWebhook ${requestId}] 🛡️ IGNORING room_finished for stream in active battle: ${roomName} (battle: ${stream.battle_id})`);
            return withCors({
              success: true,
              message: 'Stream event ignored - active battle in progress',
              ignored: true,
              room: roomName,
              stream_id: roomName,
              battle_id: stream.battle_id
            }, 200, req);
          } else {
            console.log(`[LiveKitWebhook ${requestId}] ℹ️ Stream ${roomName} linked to battle ${stream.battle_id} but battle not active. Proceeding to end stream.`);
          }
        } else {
          console.log(`[LiveKitWebhook ${requestId}] Stream ${roomName} is not in a battle. Proceeding.`);
        }

        // Safe to end the stream
        const ended = await endStream(roomName);
        if (ended) {
          return withCors({
            success: true,
            message: 'Stream ended successfully',
            ended: true,
            room: roomName,
            stream_id: roomName
          }, 200, req);
        } else {
          return withCors({
            success: false,
            error: 'Failed to end stream',
            room: roomName
          }, 500, req);
        }
      }

      // No room name? log and ignore
      console.warn(`[LiveKitWebhook ${requestId}] room_finished event with no room name`);
      return withCors({ success: true, message: 'No room name, ignored' }, 200, req);
    }

    // For other event types, just log and ack
    console.log(`[LiveKitWebhook ${requestId}] ℹ️ Received event ${event}, no action taken`);
    return withCors({
      success: true,
      message: 'Event received',
      event
    }, 200, req);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[LiveKitWebhook ${requestId}] Error:`, message);
    // Return 200 to prevent retry loops for unexpected errors? Or 500 to allow retry?
    // For now, return 500 to let LiveKit retry
    return withCors({ success: false, error: 'Webhook processing error' }, 500, req);
  }
});
