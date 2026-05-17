import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, content-length',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
  'Vary': 'Origin'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Cache-Control': 'max-age=0, s-maxage=0, no-cache, no-store, must-revalidate' }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY') || Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server not configured: missing Supabase credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { limit = 25 } = await req.json().catch(() => ({}));

    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    // 1. Find queued notifications
    const { data: notifications, error: notifError } = await supabase
      .from('offline_notifications')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (notifError) {
      throw new Error(`Failed to fetch notifications: ${notifError.message}`);
    }

    if (!notifications || notifications.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No queued notifications',
        processed: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Group notifications by user_id
    const userIds = [...new Set(notifications.map(n => n.user_id))];

    // 3. Fetch push subscriptions for all target users
    const { data: subscriptions, error: subsError } = await supabase
      .from('web_push_subscriptions')
      .select('id, user_id, endpoint, p256dh_key, auth_key, user_agent')
      .in('user_id', userIds);

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
    }

    const subsByUserId = (subscriptions || []).reduce((acc, sub) => {
      if (!acc[sub.user_id]) acc[sub.user_id] = [];
      acc[sub.user_id].push(sub);
      return acc;
    }, {} as Record<string, any[]>);

    // 4. Process each notification
    if (vapidPublicKey && vapidPrivateKey) {
      const vapidDetails = {
        subject: 'mailto:admin@trollcity.com',
        publicKey: vapidPublicKey,
        privateKey: vapidPrivateKey,
      };

      for (const notification of notifications) {
        const userSubs = subsByUserId[notification.user_id] || [];

        if (userSubs.length === 0) {
          // No subscriptions - mark as failed
          await supabase
            .from('offline_notifications')
            .update({ 
              status: 'failed', 
              last_error: 'No active push subscriptions',
              delivery_attempts: notification.delivery_attempts + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          
          failureCount++;
          continue;
        }

        let sent = false;
        const pushPayload = JSON.stringify({
          title: notification.title,
          body: notification.body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
          data: {
            url: '/',
            type: notification.type,
            ...(notification.data || {})
          }
        });

        for (const sub of userSubs) {
          try {
            const subscription = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh_key,
                auth: sub.auth_key
              }
            };

            await webPush.sendNotification(subscription, pushPayload, { vapidDetails });
            
            await supabase
              .from('offline_notifications')
              .update({ 
                status: 'delivered', 
                delivery_attempts: notification.delivery_attempts + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', notification.id);

            sent = true;
            successCount++;
            break;
          } catch (sendErr: any) {
            console.error(`Push failed for notification ${notification.id}:`, sendErr);
            
            // If subscription is gone (410 Gone), remove it
            if (sendErr?.statusCode === 410 || sendErr?.body?.includes('expired')) {
              await supabase
                .from('web_push_subscriptions')
                .delete()
                .eq('id', sub.id);
            }
          }
        }

        if (!sent) {
          await supabase
            .from('offline_notifications')
            .update({ 
              status: 'failed', 
              last_error: 'All push attempts failed',
              delivery_attempts: notification.delivery_attempts + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', notification.id);
          
          failureCount++;
        }
      }
    } else {
      // VAPID not configured - mark all as failed
      for (const notification of notifications) {
        await supabase
          .from('offline_notifications')
          .update({ 
            status: 'failed', 
            last_error: 'VAPID keys not configured',
            delivery_attempts: notification.delivery_attempts + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', notification.id);
      }
      skippedCount = notifications.length;
    }

    return new Response(JSON.stringify({ 
      success: true,
      processed: notifications.length,
      successCount,
      failureCount,
      skippedCount
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Process offline notifications error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});