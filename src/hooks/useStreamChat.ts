import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { generateUUID } from '../lib/uuid';
import { toast } from 'sonner';
import { useMissionProgress } from './useMissionProgress';
import { useChatBlockStatus } from './useChatBlockStatus';
import { isStaffProfile } from '../lib/staff';

export interface Message {
  id: string;
  txn_id?: string;
  user_id: string;
  content: string;
  created_at: string;
  type?: 'chat' | 'system' | 'gift';
  gift_type?: string;
  gift_amount?: number;
  sender_name?: string;
  username?: string;
  user_name?: string;
  user_avatar?: string;
  user_role?: string;
  user_troll_role?: string;
  user_created_at?: string;
  user_rgb_expires_at?: string;
  user_glowing_username_color?: string;
  user_profiles?: {
    username: string;
    display_name?: string | null;
    email?: string | null;
    avatar_url: string;
    role?: string | null;
    troll_role?: string | null;
    created_at?: string | null;
    rgb_username_expires_at?: string | null;
    glowing_username_color?: string | null;
  } | null;
}

interface UseStreamChatProps {
  streamId: string;
  hostId: string;
  isHost: boolean;
}

const MAX_MESSAGES = 200;
const AUTO_DELETE_INTERVAL = 5000;
const MESSAGE_LIFETIME_MS = 30000;

const BAD_NAME_VALUES = new Set([
  '',
  'unknown',
  'unknown:',
  'guest',
  'user',
  'null',
  'undefined',
]);

const cleanText = (value: any): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const isUsableName = (value: any): value is string => {
  const cleaned = cleanText(value);
  return !!cleaned && !BAD_NAME_VALUES.has(cleaned.toLowerCase());
};

const firstUsableName = (...values: any[]) => {
  for (const value of values) {
    if (isUsableName(value)) return cleanText(value);
  }

  return 'Troll Citizen';
};

const getEmailPrefix = (email?: string | null) => {
  if (!email || typeof email !== 'string') return '';
  return email.split('@')[0] || '';
};

const normalizeProfile = (rowOrProfile: any) => {
  const joinedProfile = rowOrProfile?.user_profiles || null;

  const username = firstUsableName(
    joinedProfile?.username,
    joinedProfile?.display_name,
    rowOrProfile?.username,
    rowOrProfile?.user_name,
    rowOrProfile?.display_name,
    getEmailPrefix(joinedProfile?.email),
    getEmailPrefix(rowOrProfile?.email)
  );

  return {
    username,
    display_name:
      joinedProfile?.display_name ||
      rowOrProfile?.display_name ||
      rowOrProfile?.user_name ||
      username,
    email: joinedProfile?.email || rowOrProfile?.email || null,
    avatar_url:
      joinedProfile?.avatar_url ||
      rowOrProfile?.user_avatar ||
      rowOrProfile?.avatar_url ||
      '',
    role:
      joinedProfile?.role ||
      rowOrProfile?.user_role ||
      rowOrProfile?.role ||
      null,
    troll_role:
      joinedProfile?.troll_role ||
      rowOrProfile?.user_troll_role ||
      rowOrProfile?.troll_role ||
      null,
    created_at:
      joinedProfile?.created_at ||
      rowOrProfile?.user_created_at ||
      rowOrProfile?.created_at ||
      null,
    rgb_username_expires_at:
      joinedProfile?.rgb_username_expires_at ||
      rowOrProfile?.user_rgb_expires_at ||
      rowOrProfile?.rgb_username_expires_at ||
      null,
    glowing_username_color:
      joinedProfile?.glowing_username_color ||
      rowOrProfile?.user_glowing_username_color ||
      rowOrProfile?.glowing_username_color ||
      null,
  };
};

const normalizeMessage = (row: any): Message => {
  const normalizedProfile = normalizeProfile(row);

  return {
    ...row,
    id: row.id,
    txn_id: row.txn_id,
    user_id: row.user_id,
    content: row.content || row.message || '',
    created_at: row.created_at || new Date().toISOString(),
    type: row.type || row.message_type || 'chat',

    username: normalizedProfile.username,
    user_name: normalizedProfile.username,
    user_avatar: normalizedProfile.avatar_url,
    user_role: normalizedProfile.role || undefined,
    user_troll_role: normalizedProfile.troll_role || undefined,
    user_created_at: normalizedProfile.created_at || undefined,
    user_rgb_expires_at: normalizedProfile.rgb_username_expires_at || undefined,
    user_glowing_username_color: normalizedProfile.glowing_username_color || undefined,

    user_profiles: normalizedProfile,
  };
};

export const useStreamChat = ({ streamId, hostId, isHost }: UseStreamChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [hostChatDisabledByOfficer, setHostChatDisabledByOfficer] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [streamMods, setStreamMods] = useState<string[]>([]);

  const { user, profile } = useAuthStore();
  const { userChatDisabled, chatDisabledRemainingMinutes } = useChatBlockStatus(user?.id, streamId);
  const { trackChatMessage } = useMissionProgress(streamId);

  const processedMessageIds = useRef<Set<string>>(new Set());
  const joinedUsersRef = useRef<Set<string>>(new Set());
  const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const fetchMods = async () => {
      if (!hostId) return;

      const { data, error } = await supabase
        .from('stream_moderators')
        .select('user_id')
        .eq('broadcaster_id', hostId);

      if (error) {
        console.warn('[useStreamChat] Failed to fetch stream mods:', error);
        return;
      }

      setStreamMods((data || []).map((d: any) => d.user_id).filter(Boolean));
    };

    fetchMods();
  }, [hostId]);

  useEffect(() => {
    if (!hostId) return;

    let mounted = true;

    const fetchHostModerationState = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('broadcast_chat_disabled')
        .eq('id', hostId)
        .maybeSingle();

      if (error) {
        console.warn('[useStreamChat] Failed to fetch host chat moderation state:', error);
      }

      if (mounted) {
        setHostChatDisabledByOfficer(!!data?.broadcast_chat_disabled);
      }
    };

    fetchHostModerationState();

    const moderationChannel = supabase
      .channel(`host-chat-lock:${hostId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${hostId}`,
        },
        (payload: any) => {
          setHostChatDisabledByOfficer(!!payload?.new?.broadcast_chat_disabled);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(moderationChannel);
    };
  }, [hostId]);

  useEffect(() => {
    if (!streamId) return;

    processedMessageIds.current.clear();
    joinedUsersRef.current.clear();

    const fetchMessages = async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 400));

      const { data, error } = await supabase
        .from('stream_messages')
        .select(`
          *,
          user_profiles:user_id (
            username,
            display_name,
            email,
            avatar_url,
            role,
            troll_role,
            created_at,
            rgb_username_expires_at,
            glowing_username_color
          )
        `)
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('[useStreamChat] Failed to fetch messages:', error);
        return;
      }

      const processedMessages = (data || [])
        .reverse()
        .map((row: any) => {
          const message = normalizeMessage(row);
          if (message.id) processedMessageIds.current.add(message.id);
          if (message.txn_id) processedMessageIds.current.add(message.txn_id);
          return message;
        });

      setMessages((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newHistory = processedMessages.filter((m) => !existingIds.has(m.id));
        const updated = [...newHistory, ...prev];
        return updated.length > MAX_MESSAGES
          ? updated.slice(updated.length - MAX_MESSAGES)
          : updated;
      });
    };

    fetchMessages();

    const broadcastChannel = supabase
      .channel(`stream-chat:${streamId}`)
      .on(
        'broadcast',
        { event: 'chat' },
        (payload: any) => {
          const msg = normalizeMessage(payload.payload);

          if (msg.user_id === user?.id) return;

          if (msg.txn_id && processedMessageIds.current.has(msg.txn_id)) return;
          if (msg.id && processedMessageIds.current.has(msg.id)) return;

          if (msg.txn_id) processedMessageIds.current.add(msg.txn_id);
          if (msg.id) processedMessageIds.current.add(msg.id);

          setMessages((prev) => {
            if (msg.txn_id && prev.some((m) => m.txn_id === msg.txn_id)) return prev;
            if (msg.id && prev.some((m) => m.id === msg.id)) return prev;

            const updated = [...prev, msg];
            return updated.length > MAX_MESSAGES
              ? updated.slice(updated.length - MAX_MESSAGES)
              : updated;
          });
        }
      )
      .subscribe();

    broadcastChannelRef.current = broadcastChannel;

    const presenceChannel = supabase
      .channel(`stream:${streamId}`)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: any) => {
          if (p.user_id === user?.id) return;
          if (joinedUsersRef.current.has(p.user_id)) return;

          joinedUsersRef.current.add(p.user_id);

          const systemMsg = normalizeMessage({
            id: `sys-join-${p.user_id}-${Date.now()}`,
            user_id: p.user_id,
            content: 'joined the broadcast',
            created_at: new Date().toISOString(),
            type: 'system',
            user_profiles: {
              username: firstUsableName(p.username, p.display_name, 'Guest'),
              display_name: p.display_name || p.username || null,
              avatar_url: p.avatar_url || '',
              created_at: p.joined_at || null,
              role: p.role || null,
              troll_role: p.troll_role || null,
            },
          });

          setMessages((prev) => {
            const updated = [...prev, systemMsg];
            return updated.length > MAX_MESSAGES
              ? updated.slice(updated.length - MAX_MESSAGES)
              : updated;
          });
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: any) => {
          if (p.user_id === user?.id) return;
          if (!joinedUsersRef.current.has(p.user_id)) return;

          joinedUsersRef.current.delete(p.user_id);

          const systemMsg = normalizeMessage({
            id: `sys-leave-${p.user_id}-${Date.now()}`,
            user_id: p.user_id,
            content: 'left the broadcast',
            created_at: new Date().toISOString(),
            type: 'system',
            user_profiles: {
              username: firstUsableName(p.username, p.display_name, 'Guest'),
              display_name: p.display_name || p.username || null,
              avatar_url: p.avatar_url || '',
              created_at: p.joined_at || null,
              role: p.role || null,
              troll_role: p.troll_role || null,
            },
          });

          setMessages((prev) => {
            const updated = [...prev, systemMsg];
            return updated.length > MAX_MESSAGES
              ? updated.slice(updated.length - MAX_MESSAGES)
              : updated;
          });
        });
      })
      .subscribe();

    const autoDeleteInterval = setInterval(() => {
      const now = Date.now();

      setMessages((prev) =>
        prev.filter((msg) => {
          const messageTime = new Date(msg.created_at).getTime();
          if (!Number.isFinite(messageTime)) return true;

          const messageAge = now - messageTime;
          return messageAge < MESSAGE_LIFETIME_MS;
        })
      );
    }, AUTO_DELETE_INTERVAL);

    return () => {
      clearInterval(autoDeleteInterval);

      supabase.removeChannel(broadcastChannel);
      if (broadcastChannelRef.current === broadcastChannel) {
        broadcastChannelRef.current = null;
      }

      supabase.removeChannel(presenceChannel);
    };
  }, [streamId, user?.id]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !profile) {
        toast.error('You must be logged in to send messages.');
        return;
      }

      const cleanContent = content.trim();
      if (!cleanContent) return;

      if (hostChatDisabledByOfficer) {
        toast.error('Chat is disabled for this broadcaster by officer control');
        return;
      }

      if (userChatDisabled) {
        toast.error(
          `Your chat is disabled.${
            chatDisabledRemainingMinutes
              ? ` Try again in ${chatDisabledRemainingMinutes} minute(s).`
              : ''
          }`
        );
        return;
      }

      const canBypassModeration = isHost || isStaffProfile(profile);

      if (!canBypassModeration) {
        const { data: blocked, error: blockError } = await supabase.rpc(
          'is_user_chat_blocked',
          {
            p_user_id: user.id,
            p_stream_id: streamId,
          }
        );

        if (!blockError && blocked) {
          toast.error('Your chat is disabled by moderation action.');
          return;
        }
      }

      setIsSendingMessage(true);

      const txnId = generateUUID();

      const localProfile = normalizeProfile({
        user_profiles: {
          username: (profile as any).username,
          display_name: (profile as any).display_name,
          email: (profile as any).email,
          avatar_url: (profile as any).avatar_url || '',
          role: (profile as any).role,
          troll_role: (profile as any).troll_role,
          created_at: (profile as any).created_at,
          rgb_username_expires_at: (profile as any).rgb_username_expires_at,
          glowing_username_color: (profile as any).glowing_username_color,
        },
      });

      const optimisticMessage = normalizeMessage({
        id: `temp-${txnId}`,
        txn_id: txnId,
        user_id: user.id,
        content: cleanContent,
        message: cleanContent,
        created_at: new Date().toISOString(),
        type: 'chat',
        username: localProfile.username,
        user_name: localProfile.username,
        user_avatar: localProfile.avatar_url,
        user_role: localProfile.role,
        user_troll_role: localProfile.troll_role,
        user_created_at: localProfile.created_at,
        user_rgb_expires_at: localProfile.rgb_username_expires_at,
        user_glowing_username_color: localProfile.glowing_username_color,
        user_profiles: localProfile,
      });

      setMessages((prev) => {
        const updated = [...prev, optimisticMessage];
        return updated.length > MAX_MESSAGES
          ? updated.slice(updated.length - MAX_MESSAGES)
          : updated;
      });

      processedMessageIds.current.add(txnId);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) throw new Error('Not authenticated');

        const response = await fetch(
          `${import.meta.env.VITE_EDGE_FUNCTIONS_URL}/send-message`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'chat',
              stream_id: streamId,
              txn_id: txnId,
              data: {
                content: cleanContent,

                // These fields help your Edge Function insert the real display snapshot.
                username: localProfile.username,
                user_name: localProfile.username,
                user_avatar: localProfile.avatar_url,
                user_role: localProfile.role,
                user_troll_role: localProfile.troll_role,
                user_created_at: localProfile.created_at,
                user_rgb_expires_at: localProfile.rgb_username_expires_at,
                user_glowing_username_color: localProfile.glowing_username_color,
              },
            }),
          }
        );

        const contentType = response.headers.get('content-type') || '';
        const rawText = await response.text();
        const hasJsonBody =
          contentType.toLowerCase().includes('application/json') &&
          rawText.trim().length > 0;
        const parsedBody = hasJsonBody ? JSON.parse(rawText) : undefined;

        if (!response.ok) {
          const errorMessage =
            (parsedBody as any)?.error ||
            (parsedBody as any)?.message ||
            rawText ||
            response.statusText;

          throw new Error(`Failed to send message (${response.status}): ${errorMessage}`);
        }

        const serverMessage = normalizeMessage({
          ...optimisticMessage,
          ...((parsedBody as any)?.message || (parsedBody as any)?.data || {}),
          txn_id: txnId,
          content: cleanContent,
          message: cleanContent,
          user_profiles: localProfile,
        });

        broadcastChannelRef.current
          ?.send({
            type: 'broadcast',
            event: 'chat',
            payload: serverMessage,
          })
          .catch((err) => {
            console.warn('[useStreamChat] Broadcast send failed:', err);
          });

        setMessages((prev) =>
          prev.map((m) => (m.id === `temp-${txnId}` ? serverMessage : m))
        );

        trackChatMessage();
      } catch (err: any) {
        console.error('Error sending message:', err);

        if (String(err.message || '').toLowerCase().includes('rate limit')) {
          toast.error('You are sending messages too fast. Please slow down.');
        } else {
          toast.error('Failed to send message: ' + err.message);
        }

        setMessages((prev) => prev.filter((m) => m.id !== `temp-${txnId}`));
      } finally {
        setIsSendingMessage(false);
      }
    },
    [
      user,
      profile,
      streamId,
      hostChatDisabledByOfficer,
      userChatDisabled,
      chatDisabledRemainingMinutes,
      isHost,
      trackChatMessage,
    ]
  );

  return {
    messages: messages.filter((msg) => {
      return msg.type === 'chat' || msg.type === 'system';
    }),
    sendMessage,
    hostChatDisabledByOfficer,
    userChatDisabled,
    chatDisabledRemainingMinutes,
    streamMods,
    isSendingMessage,
  };
};