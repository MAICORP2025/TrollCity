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
  const { error } = await supabase.from("notifications").insert([
    {
      user_id: userId ?? null,
      type,
      title,
      message,
      metadata,
      is_read: false,
      created_at: new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error("Notification Error:", error);
    throw error;
  }

  // Send push notification via Edge Function
  if (userId) {
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: userId,
          title,
          body: message,
          // Construct URL based on type/metadata if needed
          // For now, default handling in service worker or simple open
        }
      });
    } catch (pushErr) {
      console.warn('Failed to send push notification:', pushErr);
      // Non-blocking error
    }
  }
}
