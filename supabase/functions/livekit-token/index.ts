// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.214.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// 1️⃣ Grab secrets from Supabase
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")!;
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET")!;
const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL")!;

// 2️⃣ Build a manual JWT (Deno native) - works around SDK compatibility issues
async function generateLiveKitToken(
  identity: string,
  room: string,
  isHost: boolean = false,
  allowPublish: boolean = false
) {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);

  // Allow publishing for hosts or Tromody battle participants
  const canPublish = isHost || allowPublish || room === 'tromody-show';

  const payload = {
    iss: LIVEKIT_API_KEY,
    sub: identity,
    aud: LIVEKIT_URL,
    exp: now + 60 * 60 * 6, // 6 hours (matching original TTL)
    nbf: now - 10,
    video: {
      room,
      roomJoin: true,
      canPublish, // Hosts and Tromody participants can publish
      canSubscribe: true, // Everyone can subscribe
      canPublishData: true, // Allow data messages
      canUpdateOwnMetadata: true, // Allow updating own metadata
    },
  };

  function base64url(source: string) {
    return btoa(source)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  const encoder = new TextEncoder();

  const headerEncoded = base64url(JSON.stringify(header));
  const payloadEncoded = base64url(JSON.stringify(payload));
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(LIVEKIT_API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(unsignedToken)
  );

  const signatureEncoded = base64url(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${unsignedToken}.${signatureEncoded}`;
}

// 3️⃣ HTTP endpoint for frontend
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get payload from request
    let payload: any = {};
    try {
      payload = await req.json();
    } catch (_) {
      // Fallback to query params if JSON fails
      const url = new URL(req.url);
      payload = {
        room: url.searchParams.get('room') || 'default-room',
        identity: url.searchParams.get('identity') || '',
        isHost: url.searchParams.get('isHost') === 'true',
      };
    }

    const room = payload?.room || 'default-room';
    const identity = (payload?.identity || '').trim();
    const isHost = payload?.isHost === true || payload?.isHost === 'true';
    const allowPublish = payload?.allowPublish === true || payload?.allowPublish === 'true';

    // Validate credentials
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Missing LiveKit API credentials in Supabase Secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!identity || identity.toLowerCase() === 'undefined' || identity.toLowerCase() === 'null') {
      return new Response(
        JSON.stringify({ error: 'Identity is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!LIVEKIT_URL) {
      return new Response(
        JSON.stringify({ error: 'Missing LIVEKIT_URL in Supabase Secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate token
    console.log(`Generating token for identity: ${identity}, room: ${room}, isHost: ${isHost}, allowPublish: ${allowPublish}`);

    let token: string;
    try {
      token = await generateLiveKitToken(identity, room, isHost, allowPublish);
      
      // Validate token is a string
      if (!token || typeof token !== 'string') {
        throw new Error(`Token generation returned invalid type: ${typeof token}`);
      }
      
      if (token.length < 10) {
        throw new Error(`Token is too short: ${token.length} characters`);
      }
      
      // Validate it looks like a JWT (should have 2 dots)
      const dotCount = (token.match(/\./g) || []).length;
      if (dotCount < 2) {
        throw new Error(`Token does not appear to be a valid JWT (found ${dotCount} dots, expected 2+)`);
      }
      
      console.log(`✅ Token generated successfully: length=${token.length}, dots=${dotCount}`);
    } catch (tokenError: any) {
      console.error('❌ Token generation failed:', tokenError);
      console.error('Error details:', {
        message: tokenError?.message,
        stack: tokenError?.stack,
        identity,
        room,
        isHost
      });
      return new Response(
        JSON.stringify({ 
          error: `Failed to generate token: ${tokenError?.message || String(tokenError)}`,
          details: tokenError?.stack
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build response object
    const responseData = { 
      token: String(token), // Ensure it's definitely a string
      livekitUrl: LIVEKIT_URL,
      serverUrl: LIVEKIT_URL, // Alias for compatibility
      room,
      identity 
    };
    
    // Log response before sending
    console.log('📤 Sending response:', {
      hasToken: !!responseData.token,
      tokenType: typeof responseData.token,
      tokenLength: responseData.token?.length,
      tokenPreview: responseData.token?.substring(0, 30) + '...',
      livekitUrl: responseData.livekitUrl
    });

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (err: any) {
    console.error('Token generation error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
