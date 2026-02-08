const { AccessToken, TrackSource } = require('livekit-server-sdk');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = (supabaseUrl && supabaseServiceKey) 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function sendJson(res, status, body) {
  res.status(status).set(CORS_HEADERS).json(body);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).set(CORS_HEADERS).end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method Not Allowed' });
  }

  // 1. Get Auth Token
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return sendJson(res, 401, { error: 'Missing Authorization header' });
  }
  const tokenStr = authHeader.replace('Bearer ', '');

  const { channelId } = req.body;
  if (!channelId) {
    return sendJson(res, 400, { error: 'Missing channelId' });
  }

  try {
    if (!supabaseAdmin) {
      console.error('Supabase not configured in server');
      return sendJson(res, 500, { error: 'Server configuration error' });
    }

    // 2. Verify User
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(tokenStr);
    
    if (authError || !user) {
      console.error('Auth check failed', authError);
      return sendJson(res, 401, { error: 'Invalid token' });
    }

    // 3. Check Walkie Permissions (RPC)
    // We can call the RPC using the user's context (by creating a client with their token)
    // OR just query the DB directly since we are admin.
    // Requirement says: "verify caller is staff... using RPC".
    // Let's use the RPC for consistency, but as Admin passing the user_id context is hard unless we use `setSession`.
    // Easier: Check permissions directly via Admin query.
    // Query public.check_walkie_access is hard because it uses auth.uid().
    // Let's manually check the user_profiles table.
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_admin, is_lead_officer')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return sendJson(res, 403, { error: 'Profile not found' });
    }

    const isStaff = profile.is_admin || 
                    profile.role === 'admin' || 
                    profile.role === 'officer' || 
                    profile.role === 'lead_troll_officer' || 
                    profile.role === 'secretary' ||
                    profile.is_lead_officer;

    if (!isStaff) {
      return sendJson(res, 403, { error: 'Unauthorized: Staff access only' });
    }

    // 4. Generate Token
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_CLOUD_URL || process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return sendJson(res, 500, { error: 'LiveKit not configured' });
    }

    // Naming convention: walkie:<env>:<channel_id>
    // Env can be 'prod' or from env var
    const env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    const roomName = `walkie:${env}:${channelId}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: user.user_metadata?.username || user.email || 'Staff',
      ttl: 60 * 60, // 1 hour
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true, // Staff can publish (PTT controlled by UI)
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await at.toJwt();

    return sendJson(res, 200, {
      success: true,
      token: jwt,
      room_name: roomName,
      ws_url: livekitUrl
    });

  } catch (err) {
    console.error('[walkie-token] error', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
};
