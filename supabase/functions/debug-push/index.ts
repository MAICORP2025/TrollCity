import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY') || Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    console.log('[Debug] VAPID Public Key:', vapidPublicKey?.substring(0, 20) + '...');
    console.log('[Debug] VAPID Private Key:', vapidPrivateKey?.substring(0, 20) + '...');
    console.log('[Debug] Supabase URL:', supabaseUrl);

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const { userId = '8dff9f37-21b5-4b8e-adc2-b9286874be1a' } = await req.json().catch(() => ({}));

    // Fetch subscription details
    const { data: subscriptions, error } = await supabase
      .from('web_push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    const diagnostics = {
      vapid_keys_configured: !!(vapidPublicKey && vapidPrivateKey),
      vapid_public_length: vapidPublicKey?.length || 0,
      vapid_private_length: vapidPrivateKey?.length || 0,
      subscriptions_found: subscriptions?.length || 0,
      subscriptions: subscriptions?.map((s: any) => ({
        id: s.id,
        endpoint_type: s.endpoint?.includes('fcm') ? 'FCM' : s.endpoint?.includes('wns') ? 'WNS' : 'Unknown',
        endpoint_length: s.endpoint?.length || 0,
        has_p256dh: !!s.p256dh_key,
        p256dh_length: s.p256dh_key?.length || 0,
        has_auth: !!s.auth_key,
        auth_length: s.auth_key?.length || 0,
        is_active: s.is_active,
        created_at: s.created_at
      }))
    };

    console.log('[Debug] Diagnostics:', JSON.stringify(diagnostics, null, 2));

    return new Response(JSON.stringify(diagnostics), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Debug] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
