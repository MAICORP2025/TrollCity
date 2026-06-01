import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { generateUUID } from '../lib/uuid';

export interface BroadcastRealtimeState {
  stream: any | null;
  totalLikes: number;
  boxCount: number;
  viewerCount: number;
  messages: BroadcastMessage[];
  recentGifts: BroadcastGift[];
  participants: Participant[];
  isLive: boolean;
  hasEnded: boolean;
  isLoading: boolean;
}

export interface BroadcastMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  type: 'chat' | 'system';
  user_name?: string;
  user_avatar?: string;
  user_role?: string;
  user_troll_role?: string;
}

export interface BroadcastGift {
  [x: string]: any;
  id: string;
  gift_id: string;
  gift_name: string;
  gift_icon: string;
  gift_slug?: string;
  animation_key?: string;
  animation_type?: string;
  animation_url?: string;
  video_url?: string;
  animation_duration_ms?: number;
  sound_url?: string;
  is_fullscreen?: boolean;
  rarity?: GiftRarity | string;
  tray_visual_url?: string;
  tray_gradient?: string;
  amount: number;
  quantity?: number;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  receiver_name?: string;
  created_at: string;
}

export interface Participant {
  user_id: string;
  username: string;
  avatar_url: string;
  joined_at: string;
  is_host?: boolean;
}

interface UseBroadcastRealtimeOptions {
  streamId: string;
  userId?: string;
  initialStream?: any;
  onStreamEnd?: () => void;
  onGiftReceived?: (gift: BroadcastGift) => void;
  onMessageReceived?: (message: BroadcastMessage) => void;
  onParticipantJoin?: (participant: Participant) => void;
  onParticipantLeave?: (participant: Participant) => void;
}

export function useBroadcastRealtime({
  streamId,
  userId,
  initialStream,
  onStreamEnd,
  onGiftReceived,
  onMessageReceived,
  onParticipantJoin,
  onParticipantLeave,
}: UseBroadcastRealtimeOptions) {
  const [state, setState] = useState<BroadcastRealtimeState>({
    stream: initialStream || null,
    totalLikes: initialStream?.total_likes || 0,
    boxCount: initialStream?.box_count || 1,
    viewerCount: 0,
    messages: [],
    recentGifts: [],
    participants: [],
    isLive: initialStream?.status === 'live',
    hasEnded: initialStream?.status === 'ended',
    isLoading: !initialStream,
  });

  const channelsRef = useRef<any[]>([]);
  const messageBufferRef = useRef<BroadcastMessage[]>([]);
  const MAX_MESSAGES = 100;
  const FLUSH_INTERVAL = 100;

  const cleanup = useCallback(() => {
    channelsRef.current.forEach(channel => {
      supabase.removeChannel(channel);
    });
    channelsRef.current = [];
  }, []);

  useEffect(() => {
    if (!streamId) return;

    cleanup();

    const channels: any[]];

    // ============================================
    // 1. UNIFIED STREAM CHANNEL: postgres_changes for stream data + broadcast for chat/gifts/likes
    // ============================================
    const streamChannel = supabase
      .channel(`broadcast-stream-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;

          setState(prev => {
            if (newData.status === 'ended' || newData.is_live === false) {
              if (!prev.hasEnded) {
                onStreamEnd?.();
              }
              return {
                ...prev,
                stream: newData,
                hasEnded: true,
                isLive: false,
              };
            }

            return {
              ...prev,
              stream: newData,
              totalLikes: newData.total_likes ?? prev.totalLikes,
              boxCount: newData.box_count ?? prev.boxCount,
              viewerCount: newData.current_viewers ?? prev.viewerCount,
              isLive: newData.status === 'live',
            };
          });
        }
      )
      .on(
        'broadcast',
        { event: 'message' },
        (payload) => {
          const envelope = payload.payload;
          if (envelope.v !== 1 || envelope.stream_id !== streamId) return;

          const newMessage: BroadcastMessage = {
            id: envelope.txn_id || `msg-${Date.now()}`,
            user_id: envelope.s,
            content: envelope.d.content,
            created_at: new Date(envelope.ts).toISOString(),
            type: 'chat',
            user_name: envelope.d.user_name,
            user_avatar: envelope.d.user_avatar,
            user_role: envelope.d.user_role,
            user_troll_role: envelope.d.user_troll_role,
          };

          messageBufferRef.current.push(newMessage);
          onMessageReceived?.(newMessage);
        }
      )
      .on(
        'broadcast',
        { event: 'gift_sent' },
        (payload) => {
          const envelope = payload.payload;
          if (envelope.v !== 1 || envelope.stream_id !== streamId) return;

          const giftData = envelope.d;

          const newGift = {
            id: giftData.id,
            gift_id: giftData.gift_id,
            gift_name: giftData.gift_name,
            gift_icon: giftData.gift_icon || '🎁',
            gift_slug: giftData.gift_slug,
            animation_type: giftData.animation_type,
            amount: giftData.amount,
            quantity: giftData.quantity || 1,
            sender_id: giftData.sender_id,
            sender_name: giftData.sender_name || 'Someone',
            receiver_id: giftData.receiver_id,
            receiver_name: giftData.receiver_name,
            created_at: giftData.timestamp || new Date().toISOString(),
          } as BroadcastGift;

          setState(prev => ({
            ...prev,
            recentGifts: [...prev.recentGifts.slice(-19), newGift],
          }));

          onGiftReceived?.(newGift);
        }
      )
      .on(
        'broadcast',
        { event: 'like_sent' },
        (payload) => {
          const likeData = payload.payload;

          if (likeData.total_likes !== undefined) {
            setState(prev => ({
              ...prev,
              totalLikes: likeData.total_likes,
            }));
          } else {
            setState(prev => ({
              ...prev,
              totalLikes: prev.totalLikes + 1,
            }));
          }
        }
      )
      .subscribe();

    channels.push(streamChannel);

    // ============================================
    // 2. PARTICIPANTS (Presence) — single presence channel
    // ============================================
    const presenceChannel = supabase
      .channel(`broadcast-presence-${streamId}`)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: any) => {
          const participant: Participant = {
            user_id: p.user_id,
            username: p.username || 'Guest',
            avatar_url: p.avatar_url || '',
            joined_at: p.joined_at || new Date().toISOString(),
          };

          setState(prev => {
            const exists = prev.participants.some(pa => pa.user_id === participant.user_id);
            if (!exists) {
              return {
                ...prev,
                participants: [...prev.participants, participant],
              };
            }
            return prev;
          });

          onParticipantJoin?.(participant);
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: any) => {
          const participant: Participant = {
            user_id: p.user_id,
            username: p.username || 'Guest',
            avatar_url: p.avatar_url || '',
            joined_at: p.joined_at || new Date().toISOString(),
          };

          setState(prev => ({
            ...prev,
            participants: prev.participants.filter(pa => pa.user_id !== participant.user_id),
          }));

          onParticipantLeave?.(participant);
        });
      })
      .subscribe();

    if (userId) {
      presenceChannel.track({
        user_id: userId,
        online_at: new Date().toISOString(),
      });
    }

    channels.push(presenceChannel);

    channelsRef.current = channels;

    const flushInterval = setInterval(() => {
      if (messageBufferRef.current.length === 0) return;

      const newMessages = [...messageBufferRef.current];
      messageBufferRef.current = [];

      setState(prev => {
        const updated = [...prev.messages, ...newMessages];
        if (updated.length > MAX_MESSAGES) {
          return {
            ...prev,
            messages: updated.slice(-MAX_MESSAGES),
          };
        }
        return {
          ...prev,
          messages: updated,
        };
      });
    }, FLUSH_INTERVAL);

    return () => {
      clearInterval(flushInterval);
      cleanup();
    };
  }, [streamId, userId, cleanup, onStreamEnd, onGiftReceived, onMessageReceived, onParticipantJoin, onParticipantLeave]);

  const sendMessage = useCallback(async (content: string, userProfile: any) => {
    if (!userId || !content.trim()) return;

    const txnId = generateUUID();

    const optimisticMessage: BroadcastMessage = {
      id: txnId,
      user_id: userId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      type: 'chat',
      user_name: userProfile?.username,
      user_avatar: userProfile?.avatar_url,
      user_role: userProfile?.role,
      user_troll_role: userProfile?.troll_role,
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, optimisticMessage],
    }));

    const channel = channelsRef.current[0];
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'message',
        payload: {
          v: 1,
          txn_id: txnId,
          s: userId,
          ts: Date.now(),
          stream_id: streamId,
          d: {
            content: content.trim(),
            user_name: userProfile?.username,
            user_avatar: userProfile?.avatar_url,
            user_role: userProfile?.role,
            user_troll_role: userProfile?.troll_role,
            user_created_at: userProfile?.created_at,
            user_rgb_expires_at: userProfile?.rgb_username_expires_at,
            user_glowing_username_color: userProfile?.glowing_username_color,
          },
        },
      });
    }
  }, [streamId, userId]);

  const sendLike = useCallback(async () => {
    if (!userId) return;

    const channel = channelsRef.current[0];
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'like_sent',
        payload: {
          user_id: userId,
          stream_id: streamId,
          timestamp: Date.now(),
        },
      });
    }

    setState(prev => ({
      ...prev,
      totalLikes: prev.totalLikes + 1,
    }));
  }, [streamId, userId]);

  const clearGiftAnimation = useCallback((giftId: string) => {
    setState(prev => ({
      ...prev,
      recentGifts: prev.recentGifts.filter(g => g.id !== giftId),
    }));
  }, []);

  return {
    ...state,
    sendMessage,
    sendLike,
    clearGiftAnimation,
  };
}
