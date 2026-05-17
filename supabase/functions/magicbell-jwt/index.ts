import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { createClient as createMagicBellClient, ReceivedNotification } from 'https://esm.sh/@magicbell/magicbell-react';
import { jwtDecode } from 'https://esm.sh/jwt-decode@3.1.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Cache-Control': 'max-age=0' }
    });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const magicbellApiKey = Deno.env.get('MAGICBELL_API_KEY');
    const magicbellApiSecret = Deno.env.get('MAGICBELL_API_SECRET');

    if (!supabaseUrl || !supabaseServiceKey || !magicbellApiKey || !magicbellApiSecret) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user ID from Authorization header or query param
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    let actualUserId: string | null = null;

    if (token) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && userData?.user) {
        actualUserId = userData.user.id;
      }
    }

    if (!actualUserId && userId) {
      actualUserId = userId;
    }

    if (!actualUserId) {
      return new Response(JSON.stringify({ error: 'Unauthorized - user ID required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate MagicBell JWT for this user
    const jwtPayload = {
      sub: actualUserId,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30), // 30 days expiry
      iss: magicbellApiKey,
    };

    // Sign JWT using MagicBell API secret (HMAC-SHA256)
    const secret = magicbellApiSecret;

    // Simple JWT generation (header.payload.signature)
    const encodedHeader = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const encodedPayload = btoa(JSON.stringify(jwtPayload));

    // Import HMAC-SHA256 and create signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${encodedHeader}.${encodedPayload}`);
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureArray = await crypto.subtle.sign('HMAC', cryptoKey, data);
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureArray)));

    const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

    // Optionally store/update the JWT in user_profiles for tracking
    await supabase
      .from('user_profiles')
      .update({ magicbell_jwt: jwt, magicbell_jwt_updated_at: new Date().toISOString() })
      .eq('id', actualUserId);

    return new Response(JSON.stringify({
      jwt,
      user_id: actualUserId,
      expires_in: 60 * 60 * 24 * 30,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('magicbell-jwt error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
