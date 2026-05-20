import { handleCorsPreflight, withCors } from "../_shared/cors.ts";

/**
 * LiveKit Token Generator
 * Generates access tokens for LiveKit rooms
 */

function base64Decode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64Encode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// HMAC-SHA256 implementation
async function hmacSha256(key: string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return new Uint8Array(signature);
}

// Create JWT-like token for LiveKit
async function createLiveKitToken(params: {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  participantName: string;
  isPublisher: boolean;
}): Promise<string> {
  const { apiKey, apiSecret, roomName, participantName, isPublisher } = params;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour expiry

  const encoder = new TextEncoder();
  
  // JWT header
  const header = { alg: 'HS256', typ: 'JWT' };
  
  // The audience should be the LiveKit server URL for proper token validation
  const liveKitUrl = Deno.env.get('LIVEKIT_URL') || 'wss://troll-city-llc-4ixv208d.livekit.cloud';
  const payload = {
    iss: apiKey,
    sub: participantName,
    aud: liveKitUrl,
    exp: exp,
    nbf: now,
    iat: now,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: isPublisher,
      canSubscribe: true,
      canPublishData: true,
    }
  };

  // Create JWT-like token
  const headerBase64 = base64Encode(encoder.encode(JSON.stringify(header)));
  const payloadBase64 = base64Encode(encoder.encode(JSON.stringify(payload)));
  
  // Sign the token - use the secret string directly
  const message = `${headerBase64}.${payloadBase64}`;
  const signature = await hmacSha256(apiSecret, message);
  const signatureBase64 = base64Encode(signature);

  return `${message}.${signatureBase64}`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return withCors({
        success: false,
        error: 'Invalid JSON request body',
        stage: 'livekit-token'
      }, 400, req);
    }

    const roomName = String(body.room || body.roomName || body.channel || '');
    const userId = String(body.userId || body.identity || body.participantIdentity || '');
    // Stage Pass check — approve/live Stage Pass holders get publisher access
    let isPublisher = body.role === 'publisher' || body.role === 'host' || body.isHost === true;

    // If not auto-approved as publisher, verify Stage Pass in database
    if (!isPublisher && userId && roomName) {
      try {
        // Use Supabase client to check stream_stage_passes
        const { createClient } = await import('npm:@supabase/supabase-js@2');
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        if (supabaseUrl && supabaseServiceKey) {
          const db = createClient(supabaseUrl, supabaseServiceKey);
          const { data: stagePass } = await db
            .from('stream_stage_passes')
            .select('status')
            .eq('stream_id', roomName)
            .eq('user_id', userId)
            .in('status', ['approved', 'live'])
            .maybeSingle();

          if (stagePass) {
            isPublisher = true;
            console.log('[livekit-token] Stage Pass verified —', stagePass.status, '— publisher token granted');
          }
        }
      } catch (dbErr) {
        console.warn('[livekit-token] Stage Pass DB check failed (treated as audience):', dbErr);
      }
    }

    let participantName = String(
      body.identity || body.participantIdentity || body.userId || body.user_name || body.participantName || 'participant'
    );

    // Guard: Check for missing room
    if (!roomName) {
      console.error('[livekit-token] Missing room name');
      return withCors({
        success: false,
        error: 'Missing room name',
        stage: 'livekit-token'
      }, 400, req);
    }

    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');

    // Guard: Check for missing environment variables
    if (!apiKey || !apiSecret) {
      console.error('[livekit-token] LiveKit credentials NOT configured env vars:', { apiKey: !!apiKey, apiSecret: !!apiSecret });
      return withCors({
        success: false,
        error: 'LiveKit credentials not configured on server',
        stage: 'livekit-token',
        hint: 'Set LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Supabase secrets'
      }, 500, req);
    }

    console.log('[livekit-token] Generating token for room:', roomName, 'participant:', participantName, 'isPublisher:', isPublisher);

    const token = await createLiveKitToken({
      apiKey,
      apiSecret,
      roomName,
      participantName,
      isPublisher
    });

    console.log('[livekit-token] Token generated successfully for', participantName, 'publisher:', isPublisher);

    // Get LiveKit URL for client to connect to
    const liveKitUrl = Deno.env.get('LIVEKIT_URL') || 'wss://troll-city-llc-4ixv208d.livekit.cloud';

    return withCors({
      success: true,
      token,
      url: liveKitUrl,
      roomName,
      participantIdentity: participantName,
      participantName,
      isPublisher,
      participantType: isPublisher ? 'publisher' : 'audience'
    }, 200, req);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[livekit-token] Error generating token:', message);
    return withCors({
      success: false,
      error: message,
      stage: 'livekit-token'
    }, 500, req);
  }
});
