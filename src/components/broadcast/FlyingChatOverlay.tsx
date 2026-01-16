import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface FlyingChatOverlayProps {
  streamId?: string;
}

interface FlyingMessage {
  id: string;
  user_id: string;
  content: string;
  message_type: string;
  created_at: string;
  sender_profile?: {
    username?: string;
    rgb_username_expires_at?: string | null;
    is_ghost_mode?: boolean | null;
  };
}

const MAX_MESSAGES = 30;

export default function FlyingChatOverlay({ streamId }: FlyingChatOverlayProps) {
  const [messages, setMessages] = useState<FlyingMessage[]>([]);
  const profileCacheRef = useRef<Record<string, FlyingMessage['sender_profile']>>({});

  const loadProfiles = useCallback(async (userIds: string[]) => {
    const unique = Array.from(new Set(userIds)).filter(Boolean);
    if (unique.length === 0) return;
    const missing = unique.filter((id) => !profileCacheRef.current[id]);
    if (missing.length === 0) return;

    const { data } = await supabase
      .from('user_profiles')
      .select('id,username,rgb_username_expires_at,is_ghost_mode')
      .in('id', missing);

    (data || []).forEach((profile: any) => {
      profileCacheRef.current[profile.id] = {
        username: profile.username,
        rgb_username_expires_at: profile.rgb_username_expires_at,
        is_ghost_mode: profile.is_ghost_mode,
      };
    });
  }, []);

  const attachProfiles = useCallback(async (rows: FlyingMessage[]) => {
    const ids = rows.map((row) => row.user_id).filter(Boolean);
    await loadProfiles(ids);
    return rows.map((row) => ({
      ...row,
      sender_profile: profileCacheRef.current[row.user_id],
    }));
  }, [loadProfiles]);

  useEffect(() => {
    if (!streamId) return;
    let mounted = true;

    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id,user_id,content,message_type,created_at')
        .eq('stream_id', streamId)
        .eq('message_type', 'chat')
        .order('created_at', { ascending: false })
        .limit(MAX_MESSAGES);

      if (!mounted || !data) return;
      const ordered = data.reverse();
      const withProfiles = await attachProfiles(ordered as FlyingMessage[]);
      if (!mounted) return;
      setMessages(withProfiles.filter((msg) => !msg.sender_profile?.is_ghost_mode));
    };

    loadMessages();

    const channel = supabase
      .channel(`flying-chat-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          const newMsg = payload.new as FlyingMessage;
          if (!newMsg || newMsg.message_type !== 'chat') return;
          await loadProfiles([newMsg.user_id]);
          const enriched: FlyingMessage = {
            ...newMsg,
            sender_profile: profileCacheRef.current[newMsg.user_id],
          };
          if (enriched.sender_profile?.is_ghost_mode) return;

          setMessages((prev) => {
            const next = [...prev, enriched];
            return next.slice(-MAX_MESSAGES);
          });

          setTimeout(() => {
            setMessages((prev) => prev.filter((msg) => msg.id !== newMsg.id));
          }, 30000);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [attachProfiles, loadProfiles, streamId]);

  const items = useMemo(() => messages.filter((msg) => msg.content?.trim()), [messages]);

  return (
    <>
      {items.map((msg) => {
        const username = msg.sender_profile?.username || 'Guest';
        const hasRgb = Boolean(
          msg.sender_profile?.rgb_username_expires_at &&
            new Date(msg.sender_profile.rgb_username_expires_at) > new Date()
        );

        return (
          <div key={msg.id} className="message-item">
            <strong className={hasRgb ? 'rgb-username' : 'text-purple-300'}>{username}</strong>
            <span className="ml-1">: {msg.content}</span>
          </div>
        );
      })}
    </>
  );
}
