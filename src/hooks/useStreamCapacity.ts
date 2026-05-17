import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface StreamCapacity {
  maxInteractiveUsers: number;
  currentInteractiveUsers: number;
  isAtCapacity: boolean;
  queuePosition?: number;
  estimatedWaitTime?: number;
}

export interface CapacityQueueItem {
  id: string;
  user_id: string;
  stream_id: string;
  requested_at: string;
  position: number;
}

const MAX_INTERACTIVE_USERS = 100;

export function useStreamCapacity(streamId: string | undefined, userId?: string) {
  const [capacity, setCapacity] = useState<StreamCapacity>({
    maxInteractiveUsers: MAX_INTERACTIVE_USERS,
    currentInteractiveUsers: 0,
    isAtCapacity: false,
  });

  const [queue, setQueue] = useState<CapacityQueueItem[]>([]);
  const [isInQueue, setIsInQueue] = useState(false);

  // Fetch current capacity and queue status
  const fetchCapacity = useCallback(async () => {
    if (!streamId) return;

    try {
      // Get current interactive user count (seated users)
      const { count, error: seatsError } = await supabase
        .from('stream_seat_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('stream_id', streamId)
        .eq('status', 'active');

      if (seatsError) {
        console.error('[useStreamCapacity] Error fetching seats:', seatsError);
        return;
      }

      const currentCount = typeof count === 'number' ? count : 0;
      const isAtCapacity = currentCount >= MAX_INTERACTIVE_USERS;

      setCapacity({
        maxInteractiveUsers: MAX_INTERACTIVE_USERS,
        currentInteractiveUsers: currentCount,
        isAtCapacity,
      });

      // Check if user is in queue
      if (userId) {
        const { data: queueData, error: queueError } = await supabase
          .from('stream_capacity_queue')
          .select('*')
          .eq('stream_id', streamId)
          .eq('user_id', userId)
          .eq('status', 'waiting')
          .order('requested_at', { ascending: true });

        if (!queueError && queueData && queueData.length > 0) {
          setIsInQueue(true);
          const userQueueItem = queueData[0];
          const position = await getQueuePosition(streamId, userQueueItem.requested_at);
          setCapacity(prev => ({
            ...prev,
            queuePosition: position,
            estimatedWaitTime: position * 2, // Rough estimate: 2 minutes per person
          }));
        } else {
          setIsInQueue(false);
        }
      }

      // Get full queue for display
      const { data: fullQueue, error: fullQueueError } = await supabase
        .from('stream_capacity_queue')
        .select('*')
        .eq('stream_id', streamId)
        .eq('status', 'waiting')
        .order('requested_at', { ascending: true })
        .limit(10);

      if (!fullQueueError && fullQueue) {
        setQueue(fullQueue);
      }

    } catch (error) {
      console.error('[useStreamCapacity] Error fetching capacity:', error);
    }
  }, [streamId, userId]);

  // Get user's position in queue
  const getQueuePosition = async (streamId: string, userRequestedAt: string): Promise<number> => {
    const { data, error } = await supabase
      .from('stream_capacity_queue')
      .select('requested_at')
      .eq('stream_id', streamId)
      .eq('status', 'waiting')
      .lt('requested_at', userRequestedAt);

    if (error) return 1;
    return (data?.length || 0) + 1;
  };

  // Join capacity queue
  const joinQueue = useCallback(async () => {
    if (!streamId || !userId || isInQueue) return false;

    try {
      const { error } = await supabase
        .from('stream_capacity_queue')
        .insert({
          stream_id: streamId,
          user_id: userId,
          status: 'waiting',
          requested_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[useStreamCapacity] Error joining queue:', error);
        return false;
      }

      setIsInQueue(true);
      await fetchCapacity(); // Refresh capacity data
      return true;
    } catch (error) {
      console.error('[useStreamCapacity] Error joining queue:', error);
      return false;
    }
  }, [streamId, userId, isInQueue, fetchCapacity]);

  // Leave capacity queue
  const leaveQueue = useCallback(async () => {
    if (!streamId || !userId) return;

    try {
      const { error } = await supabase
        .from('stream_capacity_queue')
        .update({ status: 'cancelled' })
        .eq('stream_id', streamId)
        .eq('user_id', userId)
        .eq('status', 'waiting');

      if (error) {
        console.error('[useStreamCapacity] Error leaving queue:', error);
      }

      setIsInQueue(false);
      await fetchCapacity();
    } catch (error) {
      console.error('[useStreamCapacity] Error leaving queue:', error);
    }
  }, [streamId, userId, fetchCapacity]);

  // Check if user can join interactively
  const canJoinInteractively = useCallback(() => {
    return !capacity.isAtCapacity && !isInQueue;
  }, [capacity.isAtCapacity, isInQueue]);

  // Setup real-time updates
  useEffect(() => {
    if (!streamId) return;

    fetchCapacity();

    // Poll capacity every 15 seconds instead of keeping a dedicated channel open.
    const interval = setInterval(fetchCapacity, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [streamId, fetchCapacity]);

  return {
    capacity,
    queue,
    isInQueue,
    canJoinInteractively,
    joinQueue,
    leaveQueue,
    refreshCapacity: fetchCapacity,
  };
}
