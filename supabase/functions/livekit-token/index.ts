import { handleCorsPreflight, withCors } from "../_shared/cors.ts";

/**
 * LiveKit Token Generator
 * Generates access tokens for LiveKit rooms
 * Supports modes: audience, publisher, xtrollz-preview, xtrollz-viewer, xtrollz-broadcaster, ghost
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
  canPublish: boolean;
  canSubscribe: boolean;
  exp: number;
  isGhost?: boolean;
  ghostMetadata?: { role: string; hidden: boolean };
}): Promise<string> {
  const { apiKey, apiSecret, roomName, participantName, isPublisher, canPublish, canSubscribe, exp, isGhost, ghostMetadata } = params;

  const now = Math.floor(Date.now() / 1000);

  const encoder = new TextEncoder();
  
  // JWT header
  const header = { alg: 'HS256', typ: 'JWT' };
  
  // The audience should be the LiveKit server URL for proper token validation
  const liveKitUrl = Deno.env.get('LIVEKIT_URL') || 'wss://troll-city-llc-4ixv208d.livekit.cloud';
  
  // Build metadata for ghost participants
  const metadata = isGhost && ghostMetadata 
    ? ghostMetadata 
    : undefined;
  
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
      canPublish: isPublisher || canPublish,
      canSubscribe: canSubscribe,
      canPublishData: isPublisher || canPublish,
    },
    metadata: metadata,
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
    const mode = String(body.mode || '').toLowerCase();
    
    // Guard: Check for missing room
    if (!roomName) {
      console.error('[livekit-token] Missing room name');
      return withCors({
        success: false,
        error: 'Missing room name',
        stage: 'livekit-token'
      }, 400, req);
    }

    const participantName = String(
      body.identity || body.participantIdentity || body.userId || body.user_name || body.participantName || 'participant'
    );

    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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

    // Determine token permissions based on mode
    let isPublisher = false;
    let canPublish = false;
    let canSubscribe = true;
    let tokenExpiry = 3600; // 1 hour default
    let participantType = 'audience';
    let isGhost = false;
    let ghostMetadata: { role: string; hidden: boolean } | undefined;

    // XTrollz-specific modes
    const isXtrPreview = mode === 'xtrollz-preview';
    const isXtrViewer = mode === 'xtrollz-viewer';
    const isXtrBroadcaster = mode === 'xtrollz-broadcaster';

    if (isXtrPreview || isXtrViewer || isXtrBroadcaster) {
      // XTrollz tokens: verify approval in database
      let xtrollzApproved = false;
      if (userId && supabaseUrl && supabaseServiceKey) {
        try {
          const { createClient } = await import('npm:@supabase/supabase-js@2');
          const db = createClient(supabaseUrl, supabaseServiceKey);
          const { data: profile } = await db
            .from('user_profiles')
            .select('xtrollz_access_status, age_verified, identity_verified, is_banned, account_state')
            .eq('id', userId)
            .maybeSingle();

          xtrollzApproved = !!profile &&
            profile.xtrollz_access_status === 'approved' &&
            profile.age_verified === true &&
            profile.identity_verified === true &&
            profile.is_banned === false &&
            !['banned', 'jailed'].includes(profile.account_state || '');
        } catch (dbErr) {
          console.warn('[livekit-token] XTrollz approval check failed:', dbErr);
        }
      }

      if (!xtrollzApproved) {
        return withCors({
          success: false,
          error: 'XTrollz access not approved',
          stage: 'livekit-token'
        }, 403, req);
      }

      if (isXtrPreview) {
        canPublish = false;
        canSubscribe = true;
        tokenExpiry = 600; // 10 minutes for previews
        participantType = 'preview';
      } else if (isXtrViewer) {
        canPublish = false;
        canSubscribe = true;
        tokenExpiry = 3600; // 1 hour
        participantType = 'viewer';
      } else if (isXtrBroadcaster) {
        canPublish = true;
        canSubscribe = true;
        tokenExpiry = 7200; // 2 hours
        participantType = 'broadcaster';
        isPublisher = true;
      }
    } else {
      // Existing logic for other modes (publisher, audience, ghost, etc.)
      isPublisher = body.role === 'publisher' || body.role === 'host' || body.isHost === true;
      
      // Check if this is a ghost participant request
      isGhost = body.role === 'ghost' || body.ghost === true;
      ghostMetadata = isGhost ? { role: 'ghost', hidden: true } : undefined;

      // If not auto-approved as publisher, verify Stage Pass in database
      if (!isPublisher && userId && roomName && supabaseUrl && supabaseServiceKey) {
        try {
          const { createClient } = await import('npm:@supabase/supabase-js@2');
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
        } catch (dbErr) {
          console.warn('[livekit-token] Stage Pass DB check failed (treated as audience):', dbErr);
        }
      }
    }

    console.log('[livekit-token] Generating token for room:', roomName, 'participant:', participantName, 'mode:', mode, 'isPublisher:', isPublisher, 'participantType:', participantType);

    const token = await createLiveKitToken({
      apiKey,
      apiSecret,
      roomName,
      participantName,
      isPublisher,
      canPublish,
      canSubscribe,
      exp: tokenExpiry,
      isGhost,
      ghostMetadata,
    });

    console.log('[livekit-token] Token generated successfully for', participantName, 'mode:', mode, {
      roomName,
      hasToken: !!token,
      tokenLength: token?.length,
    });

    const liveKitUrl = Deno.env.get('LIVEKIT_URL') || Deno.env.get('VITE_LIVEKIT_URL') || 'wss://troll-city-llc-4ixv208d.livekit.cloud';

    return withCors({
      success: true,
      token,
      url: liveKitUrl,
      roomName,
      participantIdentity: participantName,
      participantName,
      isPublisher,
      isGhost,
      participantType,
      ghostMetadata: isGhost ? ghostMetadata : undefined,
      mode,
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
