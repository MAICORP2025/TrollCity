import { supabase } from "./supabase";
import { NotificationType } from "../types/notifications";

export type { NotificationType };

export async function sendNotification(
  userId: string | null,
  type: NotificationType,
  title: string,
  message: string,
  metadata: Record<string, any> = {}
) {
  if (!userId) {
    console.warn("sendNotification called with null userId");
    return;
  }

  // Create notification in database via secure RPC
  const { error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_metadata: metadata
  });

  if (error) {
    console.warn("RPC create_notification failed:", error.message);
    // Don't fall back to direct insert - RPC must work
    return;
  }

  // Send push notification via Web Push (VAPID)
  if (userId) {
    let url = '/';
    if (type === 'message' && metadata?.sender_id) {
      url = `/utromail?recipientId=${metadata.sender_id}`;
    } else if (metadata?.url) {
      url = metadata.url;
    }

    supabase.functions.invoke('push-notifications', {
      body: {
        userId,
        notification: {
          type: type.toUpperCase(),
          title,
          body: message,
          url,
          data: metadata
        },
        options: { ttl: 86400, urgency: 'normal' }
      }
    }).catch((pushErr: unknown) => {
      console.warn('Web Push failed:', pushErr);
    });
  }
}
