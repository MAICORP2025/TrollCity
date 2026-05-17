import { supabaseAdmin } from './supabaseAdmin'

export interface OfflineNotificationData {
  user_id: string
  title: string
  body: string
  type: string
  url?: string
  data?: Record<string, unknown>
}

export async function queueOfflineNotification(data: OfflineNotificationData): Promise<void> {
  const { error } = await supabaseAdmin.from('offline_notifications').insert({
    user_id: data.user_id,
    title: data.title,
    body: data.body,
    type: data.type,
    url: data.url,
    data: data.data,
    status: 'queued',
    delivery_attempts: 0,
  })

  if (error) {
    console.error('Failed to queue offline notification:', error)
  }
}

export async function queueOfflineNotifications(
  notifications: OfflineNotificationData[]
): Promise<void> {
  if (notifications.length === 0) return

  const inserts = notifications.map((n) => ({
    user_id: n.user_id,
    title: n.title,
    body: n.body,
    type: n.type,
    url: n.url,
    data: n.data,
    status: 'queued',
    delivery_attempts: 0,
  }))

  const { error } = await supabaseAdmin.from('offline_notifications').insert(inserts)

  if (error) {
    console.error('Failed to queue offline notifications:', error)
  }
}