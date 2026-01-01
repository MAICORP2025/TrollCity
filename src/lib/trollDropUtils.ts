import { supabase } from './supabase';
import { TrollDrop } from '../types/trollDrop';

const TROLL_DROP_DURATION = 15000;
const TROLL_DROP_MAX_PER_BROADCAST = 2;
const BROADCAST_DURATION_THRESHOLD = 3600000;

export async function getTrollDropCount(streamId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('troll_drops')
      .select('id', { count: 'exact' })
      .eq('stream_id', streamId);

    if (error) {
      console.error('Error getting troll drop count:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Exception in getTrollDropCount:', err);
    return 0;
  }
}

export async function canDropTroll(streamId: string, broadcastDurationMs: number): Promise<boolean> {
  try {
    const dropCount = await getTrollDropCount(streamId);

    if (broadcastDurationMs < BROADCAST_DURATION_THRESHOLD) {
      return dropCount < 1;
    } else {
      return dropCount < TROLL_DROP_MAX_PER_BROADCAST;
    }
  } catch (err) {
    console.error('Exception in canDropTroll:', err);
    return false;
  }
}

export async function createTrollDrop(
  streamId: string,
  color: 'red' | 'green',
  userId?: string
): Promise<TrollDrop | null> {
  try {
    const now = Date.now();
    const expiresAt = now + TROLL_DROP_DURATION;

    const { data, error } = await supabase
      .from('troll_drops')
      .insert({
        stream_id: streamId,
        user_id: userId || 'system',
        created_at: new Date(now).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating troll drop:', error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      streamId: data.stream_id,
      color: color,
      createdAt: new Date(data.created_at).getTime(),
      expiresAt: new Date(data.expires_at).getTime(),
      participants: [],
      totalAmount: 5000,
      claimed: false,
    };
  } catch (err) {
    console.error('Exception in createTrollDrop:', err);
    return null;
  }
}

export async function getTrollDropsByStream(streamId: string): Promise<TrollDrop[]> {
  try {
    const { data, error } = await supabase
      .from('troll_drops')
      .select('id, stream_id, created_at, expires_at')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching troll drops:', error);
      return [];
    }

    return (data || []).map((drop: any) => ({
      id: drop.id,
      streamId: drop.stream_id,
      color: 'red',
      createdAt: new Date(drop.created_at).getTime(),
      expiresAt: new Date(drop.expires_at).getTime(),
      participants: [],
      totalAmount: 5000,
      claimed: false,
    }));
  } catch (err) {
    console.error('Exception in getTrollDropsByStream:', err);
    return [];
  }
}
