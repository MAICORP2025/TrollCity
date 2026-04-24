import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import * as webPush from 'https://esm.sh/web-push@3.6.6';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, content-length',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
  'Vary': 'Origin'
};

// Notification types
interface NotificationPayload {
  type: 'BATTLE_INVITATION' | 'NEW_LIVESTREAM' | 'GIFT_RECEIVED' |
        'PRIVATE_MESSAGE' | 'MODERATION_ALERT' | 'FRIEND_REQUEST' | 'STREAM_GOING_LIVE';
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  tag?: string;
}

interface PushRequest {
  userId?: string;
  user_ids?: string[];
  notification: NotificationPayload;
  options?: {
    ttl?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
  };
}

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
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@maitrollcity.com';

    if (!supabaseUrl || !supabaseServiceKey || !vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { userId, user_ids, notification, options }: PushRequest = await req.json();

    if (!userId && !user_ids) {
      return new Response(JSON.stringify({ error: 'Missing userId or user_ids' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize to array
    const targetUserIds = userId ? [userId] : (user_ids || []);
    let totalSent = 0;
    let totalFailed = 0;

    // Send to each user
    for (const uid of targetUserIds) {
      const { data: subscriptions, error: subError } = await supabase
        .from('web_push_subscriptions')
        .select('*')
        .eq('user_id', uid)
        .eq('is_active', true);

      if (subError || !subscriptions || subscriptions.length === 0) {
        if (subError) console.error('Subscription fetch error for', uid, subError);
        continue;
      }

      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            await webPush.sendNotification(
              { endpoint: sub.endpoint, keys: sub.keys as any },
              JSON.stringify({
                title: notification.title,
                body: notification.body,
                icon: notification.icon || '/icons/icon-192.png',
                badge: notification.badge || '/icons/icon-72.png',
                image: notification.image,
                url: notification.url || '/',
                type: notification.type,
                tag: notification.tag || `troll-city-${Date.now()}`,
                requireInteraction: notification.requireInteraction || false,
                data: { ...notification.data, userId: uid, timestamp: Date.now() }
              }),
              { TTL: options?.ttl || 86400, urgency: options?.urgency || 'normal', topic: options?.topic }
            );
            return { success: true };
          } catch (error: any) {
            if (error.statusCode === 410 || error.statusCode === 404) {
              await supabase.from('web_push_subscriptions').update({ is_active: false, updated_at: new Date().toISOString() }).eq('endpoint', sub.endpoint);
            }
            throw error;
          }
        })
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      totalSent += successCount;
      totalFailed += failCount;

      // Log per user
      await supabase.from('push_notification_logs').insert({
        user_id: uid,
        notification_type: notification.type,
        title: notification.title,
        body: notification.body,
        sent_at: new Date().toISOString(),
        success_count: successCount,
        failure_count: failCount
      });
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent, failed: totalFailed, total_users: targetUserIds.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Push error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
