import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PURCHASE_REQUIRED_MESSAGE } from "../_shared/purchaseGate.ts";

/* ============================================================================
 * 🛡️  CRITICAL STREAMING INFRASTRUCTURE - PROTECTED
 *
 * Supabase Edge Function for live stream creation.
 * This function runs at the edge and must be deployed with care.
 *
 * PROTECTION: This file is monitored by pre-commit hook.
 * Any changes require explicit confirmation during commit.
 * ============================================================================ */

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const { action, stream_id, user_id, title, category } = body || {};
    const normalizedAction = String(action || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
    const receivedAction = action ?? null;
    const supportedActions = [
      'start',
      'start_stream',
      'end',
      'status',
      'force-end-all',
    ];

    console.log('[Live Function] received action', { receivedAction, normalizedAction });

    const requesterId = authData.user.id;
    const { data: requesterProfile } = await supabase
      .from('user_profiles')
      .select('id, is_admin, is_lead_officer, has_paid')
      .eq('id', requesterId)
      .maybeSingle();
    const isAdmin = !!requesterProfile?.is_admin;
    const hasElevatedAccess = Boolean(requesterProfile?.is_admin || requesterProfile?.is_lead_officer);

    if (!normalizedAction) {
      return new Response(JSON.stringify({
        error: 'Missing action',
        receivedAction,
        supportedActions,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (normalizedAction === 'start' || normalizedAction === 'start_stream') {
      if (!hasElevatedAccess && !requesterProfile?.has_paid) {
        return new Response(
          JSON.stringify({ error: PURCHASE_REQUIRED_MESSAGE }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      if (!user_id || requesterId !== user_id) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!title) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!category) {
        return new Response(JSON.stringify({ error: 'Missing category' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const now = new Date().toISOString();

      const { data: streamRow, error } = await supabase
        .from('streams')
        .insert({
          broadcaster_id: user_id,
          title,
          category,
          current_viewers: 1,
          is_live: true,
          status: 'live',
          started_at: now,
          start_time: now,
          created_at: now,
        })
        .select('*')
        .single();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Award birthday coins if eligible (when user goes live on their birthday)
      try {
        const { data: birthdayResult } = await supabase.rpc('award_birthday_coins_if_eligible', {
          p_user_id: user_id
        });
        if (birthdayResult?.success) {
          console.log(`[Live] Birthday coins awarded to user ${user_id}: ${birthdayResult.coins_awarded} coins`);
        }
      } catch (birthdayErr) {
        // Non-critical error, log but don't fail stream creation
        console.warn('[Live] Birthday coin check failed:', birthdayErr);
      }

      // Check if user has active broadcast notification feature and send to followers via push
      try {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('username, broadcast_notification_until')
          .eq('id', user_id)
          .maybeSingle();

        if (profileData?.broadcast_notification_until) {
          const notificationUntil = new Date(profileData.broadcast_notification_until);
          if (notificationUntil > new Date()) {
            // Get all followers who have push subscriptions
            const { data: follows } = await supabase
              .from('user_follows')
              .select('follower_id')
              .eq('following_id', user_id);

            if (follows && follows.length > 0) {
              const followerIds = follows.map(f => f.follower_id);
              const magicbellApiKey = Deno.env.get('MAGICBELL_API_KEY');
              const magicbellApiSecret = Deno.env.get('MAGICBELL_API_SECRET');

              if (magicbellApiKey && magicbellApiSecret) {
                // Send notification via MagicBell API
                const magicbellResponse = await fetch('https://api.magicbell.com/notifications', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-MAGICBELL-API-KEY': magicbellApiKey,
                    'X-MAGICBELL-API-SECRET': magicbellApiSecret,
                  },
                  body: JSON.stringify({
                    notification: {
                      title: `${profileData.username} is now live!`,
                      body: `${profileData.username} just started streaming. Tap to watch!`,
                      action_url: `/live/${streamRow.id}`,
                      data: {
                        stream_id: streamRow.id,
                        broadcaster_id: user_id,
                        broadcaster_username: profileData.username
                      }
                    },
                    users: followerIds.map(id => ({ external_user_id: id }))
                  }),
                });

                if (!magicbellResponse.ok) {
                  const errorText = await magicbellResponse.text();
                  console.warn(`[Live] MagicBell API error: ${magicbellResponse.status} ${errorText}`);
                } else {
                  const result = await magicbellResponse.json();
                  console.log(`[Live] Notifications sent to ${follows.length} followers via MagicBell:`, result);
                }
              } else {
                console.warn('[Live] Missing MagicBell credentials, skipping stream notification');
              }
            }
          }

          // Clear the notification feature after using it (one-time use)
          await supabase
            .from('user_profiles')
            .update({ broadcast_notification_until: null })
            .eq('id', user_id);
        }
      } catch (notifyErr) {
        console.warn('[Live] Failed to send stream notifications:', notifyErr);
      }

      return new Response(JSON.stringify({ success: true, stream: streamRow }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (normalizedAction === 'end') {
      if (!stream_id) {
        return new Response(JSON.stringify({ error: 'Missing stream_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: stream } = await supabase
        .from('streams')
        .select('id, broadcaster_id')
        .eq('id', stream_id)
        .maybeSingle();
      if (!stream) {
        return new Response(JSON.stringify({ error: 'Stream not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (stream.broadcaster_id !== requesterId && !isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('streams')
        .update({ is_live: false, ended_at: now })
        .eq('id', stream_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (normalizedAction === 'status') {
      if (!stream_id && !user_id) {
        return new Response(JSON.stringify({ error: 'Missing stream_id or user_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      let query = supabase.from('streams').select('*');
      if (stream_id) query = query.eq('id', stream_id);
      if (user_id) query = query.eq('broadcaster_id', user_id);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, stream: data || null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (normalizedAction === 'force-end-all') {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('streams')
        .update({ is_live: false, ended_at: now })
        .eq('is_live', true)
        .select('id');
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, ended: (data || []).length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      error: 'Unsupported action',
      receivedAction,
      supportedActions,
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});