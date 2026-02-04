import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

type TokenRequest = {
  room?: string;
  roomName?: string;
  identity?: string;
  name?: string;
  role?: string;
  allowPublish?: boolean | string | number;
  level?: number | string;
  user_id?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[livekit-token] 🔄 New request: ${req.method} ${req.url}`);
  
  if (req.method !== "POST") {
    console.log(`[livekit-token] ❌ Method not allowed: ${req.method}`);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Extract and validate authorization header
    const auth = req.headers.authorization || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!jwt) {
      console.log('[livekit-token] ❌ Missing Authorization header');
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    
    console.log('[livekit-token] ✅ Authorization header found');

    // Parse request body
    const payload: TokenRequest = req.body || {};
    const roomName = String(payload.room || payload.roomName || "").trim();
    let identity = payload.identity;
    const name = String(payload.name || payload.identity || "Anonymous");

    console.log('[livekit-token] 📝 Request payload:', {
      roomName,
      identity,
      name,
      allowPublish: payload.allowPublish,
      role: payload.role,
      level: payload.level,
      hasAuth: !!jwt
    });

    if (!roomName) {
      console.log('[livekit-token] ❌ Missing roomName');
      return res.status(400).json({ error: "Missing roomName" });
    }
    
    console.log('[livekit-token] ✅ Room name validated:', roomName);

    // Validate LiveKit environment variables
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    console.log("[livekit-token] using LiveKit URL:", livekitUrl);

    console.log("[livekit-token] LIVEKIT CONFIG CHECK", { 
      livekitUrl, 
      apiKeyPrefix: apiKey?.slice(0, 6), 
    });

    console.log('[livekit-token] 🔧 Environment check:', {
      hasApiKey: !!apiKey,
      hasApiSecret: !!apiSecret,
      hasLivekitUrl: !!livekitUrl,
      livekitUrl
    });

    if (!apiKey || !apiSecret) {
      console.error('[livekit-token] ❌ Missing LiveKit environment variables');
      return res.status(500).json({ error: "LiveKit env vars missing" });
    }
    
    console.log('[livekit-token] ✅ LiveKit environment variables validated');

    // Validate Supabase environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[livekit-token] ❌ Missing Supabase environment variables');
      return res.status(500).json({ error: "Supabase env vars missing" });
    }
    
    console.log('[livekit-token] ✅ Supabase environment variables validated');

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !userData?.user) {
      console.error("[livekit-token] User validation error:", userError?.message);
      return res.status(401).json({ error: "Invalid Supabase session" });
    }

    // Use user ID as identity if not provided, or validate identity matches user
    if (!identity || identity === "null") {
      identity = userData.user.id;
    }

    // Optional: Enforce identity matches logged in user for security
    // if (identity !== userData.user.id) {
    //   return res.status(403).json({ error: "Identity mismatch" });
    // }

    // Determine publish permissions
    let canPublish = false;
    let role = 'viewer';

    // Fetch stream and user profile in parallel
    const [streamResult, profileResult] = await Promise.all([
      supabase
        .from('streams')
        .select('id, user_id, broadcaster_id')
        .or(`id.eq.${roomName},livekit_room.eq.${roomName}`)
        .maybeSingle(),
      supabase
        .from('user_profiles')
        .select('role, is_admin')
        .eq('id', userData.user.id)
        .single()
    ]);

    const stream = streamResult.data;
    const userProfile = profileResult.data;

    if (stream) {
      const broadcasterId = stream.broadcaster_id || stream.user_id;
      
      // 1. Host/Owner
      if (broadcasterId === userData.user.id) {
        canPublish = true;
        role = 'broadcaster';
      }
      // 2. Staff/Admin (Explicit override)
      else if (
        userProfile?.is_admin === true || 
        ['admin', 'moderator', 'troll_officer', 'lead_troll_officer', 'super_admin'].includes(userProfile?.role || '')
      ) {
        canPublish = true;
        role = 'admin'; // or specific role
      }
      // 3. Valid Guest Seat
      else {
        // Check active seat session
        const { data: seatSession } = await supabase
          .from('stream_seat_sessions')
          .select('id, status')
          .eq('stream_id', stream.id)
          .eq('user_id', userData.user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (seatSession) {
          canPublish = true;
          role = 'guest';
        } else {
          // Check legacy stream_guests table if seat session not found (backward compatibility if needed)
          // But strict requirement says "Valid Guest Seat (paid seat session)". 
          // We will strictly enforce seat session for new system.
          // If you want to support legacy, uncomment below:
          /*
          const { data: guest } = await supabase
            .from('stream_guests')
            .select('status')
            .eq('stream_id', stream.id)
            .eq('user_id', userData.user.id)
            .eq('status', 'active')
            .maybeSingle();
          if (guest) canPublish = true;
          */
        }
      }
      
      // 4. Server-side Stage Cap Enforcement (Safety Net)
      // Even if logic above allows it, we can enforce a hard cap here if needed.
      // However, if they have a valid seat, they should be allowed. 
      // The seat system should prevent > 6 active seats.
      
    } else {
      // Stream not found in DB - Fallback for testing/admin only?
      // Requirement says "Server must compute permissions strictly from trusted sources".
      // If stream is not in DB, we probably shouldn't allow publish unless it's an admin testing?
      // Or maybe it's a new stream not yet synced?
      // For safety, default to FALSE unless admin.
      
      if (
        userProfile?.is_admin === true || 
        ['admin', 'super_admin'].includes(userProfile?.role || '')
      ) {
        canPublish = true;
        role = 'admin';
      } else {
        canPublish = false;
        role = 'viewer';
      }
    }

    console.log(`[livekit-token] Permissions calculated: user=${userData.user.id}, role=${role}, canPublish=${canPublish}`);

    // Create LiveKit token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: String(identity),
      name: String(name),
      ttl: 60 * 60, // 1 hour
      metadata: JSON.stringify({
        identity,
        role: role,
        level: Number(payload.level || 1),
        user_id: userData.user.id,
      }),
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublish: canPublish,
      canPublishData: canPublish,
    });

    // ✅ CRITICAL FIX: Ensure toJwt() returns a string, not an object
    // Handle both sync and async toJwt() methods
    let jwtString: string;
    try {
      const jwtResult = token.toJwt();
      
      // If it's a Promise, await it
      const jwt = jwtResult instanceof Promise ? await jwtResult : jwtResult;
      
      // ✅ STRICT VALIDATION: Ensure jwt is a string
      if (typeof jwt !== 'string') {
        console.error('[livekit-token] toJwt() returned non-string:', {
          type: typeof jwt,
          value: jwt,
          stringified: JSON.stringify(jwt)
        });
        throw new Error(`toJwt() returned ${typeof jwt} instead of string`);
      }
      
      // ✅ Validate JWT format (should start with 'eyJ')
      if (!jwt.startsWith('eyJ')) {
        console.error('[livekit-token] JWT does not have expected format:', {
          jwtPreview: jwt.substring(0, 50),
          jwtLength: jwt.length
        });
        throw new Error('Invalid JWT format');
      }
      
      jwtString = jwt;
    } catch (jwtError: any) {
      console.error('[livekit-token] Failed to generate JWT:', jwtError);
      throw new Error(`JWT generation failed: ${jwtError?.message || jwtError}`);
    }

    // ✅ Return string, NOT object
    return res.status(200).json({
      token: jwtString, // ✅ String JWT, not AccessToken object
      livekitUrl: livekitUrl || null,
      room: roomName,
      identity: String(identity),
      allowPublish: canPublish,
    });
  } catch (e: any) {
    console.error("❌ livekit-token error:", e);
    return res.status(500).json({ error: e.message || "Unknown error" });
  }
}
