import { supabase } from './supabase';

type StreamAnalyticsEventType = 'join' | 'leave' | 'gift' | 'stream_start' | 'stream_end';

const lastEventAt = new Map<string, number>();

// Auto-cleanup: evict entries older than 60 seconds every 60 seconds
// Prevents unbounded memory growth during long sessions
let _analyticsCleanupInterval: ReturnType<typeof setInterval> | null = null;
if (typeof window !== 'undefined') {
  _analyticsCleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of lastEventAt.entries()) {
      if (now - ts > 60_000) {
        lastEventAt.delete(key);
      }
    }
  }, 60_000);
}

export async function logStreamAnalyticsEvent(
  streamId: string | null | undefined,
  userId: string | null | undefined,
  eventType: StreamAnalyticsEventType,
  giftAmount?: number | null
) {
  if (!streamId || !userId) return;

  const key = `${streamId}:${userId}:${eventType}`;
  const now = Date.now();
  if (now - (lastEventAt.get(key) || 0) < 30_000) return;
  lastEventAt.set(key, now);

  try {
    const { error } = await supabase.rpc('log_stream_analytics_event', {
      p_stream_id: streamId,
      p_user_id: userId,
      p_event_type: eventType,
      p_gift_amount: Math.max(0, Math.floor(Number(giftAmount || 0))),
    });

    if (error && import.meta.env.DEV) {
      console.warn('[StreamAnalytics] log failed:', error);
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[StreamAnalytics] log exception:', err);
    }
  }
}
