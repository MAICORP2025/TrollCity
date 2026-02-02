import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Send, Coins, Shield, Image as ImageIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../lib/store";
import { toast } from "sonner";
import ClickableUsername from "../ClickableUsername";
import { UserBadge } from "../UserBadge";

interface ChatBoxProps {
  streamId: string;
  onProfileClick?: (profile: any) => void;
  onCoinSend?: (user: string, amount: number) => void;
  room?: any; // LiveKit Room
  isBroadcaster?: boolean;
}

interface Message {
  id: string;
  user_id: string;
  content: string;
  message_type: string;
  created_at: string;
  sender_profile?: {
    id: string;
    username: string;
    perks: string[];
    hasInsurance?: boolean;
    rgbExpiresAt?: string;
    avatar_url?: string;
    is_ghost_mode?: boolean;
    role?: string | null;
    is_admin?: boolean;
    drivers_license_status?: string;
    is_banned?: boolean;
  };
}

export default function ChatBox({ streamId, onProfileClick, onCoinSend, isBroadcaster }: ChatBoxProps) {
  const { user } = useAuthStore();
  const uid = user?.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const suppressAutoScrollRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const userCacheRef = useRef<
    Record<
      string,
      {
        id: string;
        username: string;
        perks: string[];
        hasInsurance: boolean;
        rgbExpiresAt?: string;
        avatar_url?: string;
        is_ghost_mode?: boolean;
        role?: string | null;
        is_admin?: boolean;
        drivers_license_status?: string;
        is_banned?: boolean;
      }
    >
  >({});
  
  const [showCoinInput, setShowCoinInput] = useState<string | null>(null);
  const [coinAmount, setCoinAmount] = useState(10);

  const [isGlobalBanned, setIsGlobalBanned] = useState(false);

  const fetchUserProfile = useCallback(async (userId: string) => {
    if (userCacheRef.current[userId]) return userCacheRef.current[userId];

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, username, rgb_username_expires_at, avatar_url, is_ghost_mode, role, is_admin, drivers_license_status, is_banned')
        .eq('id', userId)
        .single();
        
      const { data: perks } = await supabase
        .from('user_perks')
        .select('perk_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      const { data: insurance } = await supabase
        .from('user_insurances')
        .select('insurance_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      const userData = {
        id: profile?.id || userId,
        username: profile?.username || 'Unknown Troll',
        perks: perks?.map((p) => p.perk_id) || [],
        hasInsurance: Boolean(insurance && insurance.length > 0),
        rgbExpiresAt: profile?.rgb_username_expires_at,
        avatar_url: profile?.avatar_url,
        is_ghost_mode: profile?.is_ghost_mode,
        role: profile?.role ?? null,
        is_admin: profile?.is_admin ?? false,
        drivers_license_status: profile?.drivers_license_status,
        is_banned: profile?.is_banned ?? false
      };

      userCacheRef.current[userId] = userData;
      return userData;
    } catch (e) {
      console.error('Failed to fetch user profile', e);
      return {
        id: userId,
        username: 'Unknown',
        perks: [],
        hasInsurance: false,
      };
    }
  }, []);

  // Check global ban status and get current user
  useEffect(() => {
    const checkBanStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await fetchUserProfile(user.id);
        if (profile.is_banned) {
          setIsGlobalBanned(true);
        }
      }
    };
    checkBanStatus();
  }, [fetchUserProfile]);

  const incomingQueueRef = useRef<Message[]>([]);
  const processQueueTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const processIncomingQueue = useCallback(async () => {
    if (incomingQueueRef.current.length === 0) return;

    // Take snapshot of current queue and clear it
    const queue = [...incomingQueueRef.current];
    incomingQueueRef.current = [];

    // 1. Identify missing profiles
    const uniqueUserIds = [...new Set(queue.map(m => m.user_id || (m as any).sender_id).filter(Boolean))];
    
    // Optimistically cache profiles from broadcast messages
    queue.forEach(msg => {
        const uid = msg.user_id || (msg as any).sender_id;
        if (uid && msg.sender_profile && !userCacheRef.current[uid]) {
            userCacheRef.current[uid] = {
              ...msg.sender_profile,
              hasInsurance: msg.sender_profile.hasInsurance ?? false
            };
        }
    });

    const missingUserIds = uniqueUserIds.filter(uid => !userCacheRef.current[uid]);

    // 2. Batch fetch missing profiles
    if (missingUserIds.length > 0) {
        try {
            const { data: profiles } = await supabase
                .from('user_profiles')
                .select('id, username, rgb_username_expires_at, avatar_url, is_ghost_mode, role, is_admin, drivers_license_status, is_banned')
                .in('id', missingUserIds);

            const { data: perks } = await supabase
                .from('user_perks')
                .select('user_id, perk_id')
                .in('user_id', missingUserIds)
                .eq('is_active', true);

            const { data: insurance } = await supabase
                .from('user_insurances')
                .select('user_id, insurance_id')
                .in('user_id', missingUserIds)
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString());

            missingUserIds.forEach(uid => {
                const profile = profiles?.find(p => p.id === uid);
                const userPerks = perks?.filter(p => p.user_id === uid).map(p => p.perk_id) || [];
                const hasInsurance = insurance?.some(i => i.user_id === uid) || false;

                userCacheRef.current[uid] = {
                    id: uid,
                    username: profile?.username || 'Unknown Troll',
                    perks: userPerks,
                    hasInsurance,
                    rgbExpiresAt: profile?.rgb_username_expires_at,
                    avatar_url: profile?.avatar_url,
                    is_ghost_mode: profile?.is_ghost_mode,
                    role: profile?.role ?? null,
                    is_admin: profile?.is_admin ?? false,
                    drivers_license_status: profile?.drivers_license_status,
                    is_banned: profile?.is_banned ?? false
                };
            });
        } catch (err) {
            console.error('Error batch processing chat queue:', err);
        }
    }

    // 3. Update messages state with all queued messages
    setMessages(prev => {
        const newMessages: Message[] = [];
        
        // Process each message in the queue
        for (const newMsg of queue) {
            const msgUserId = newMsg.user_id || (newMsg as any).sender_id;
            const createdAt = new Date(newMsg.created_at).getTime();

            // Check duplicates against PREV and NEW messages in this batch
            const isDuplicate = prev.some(msg => {
                const existingUserId = msg.user_id || (msg as any).sender_id;
                if (existingUserId !== msgUserId) return false;
                if (msg.content !== newMsg.content) return false;
                const existingTime = new Date(msg.created_at).getTime();
                return Math.abs(existingTime - createdAt) <= 1000;
            }) || newMessages.some(msg => {
                const existingUserId = msg.user_id || (msg as any).sender_id;
                if (existingUserId !== msgUserId) return false;
                if (msg.content !== newMsg.content) return false;
                const existingTime = new Date(msg.created_at).getTime();
                return Math.abs(existingTime - createdAt) <= 1000;
            });

            if (!isDuplicate) {
                newMessages.push({
                    ...newMsg,
                    user_id: msgUserId,
                    sender_profile: userCacheRef.current[msgUserId]
                });
            }
        }

        if (newMessages.length === 0) return prev;

        // Clean up old optimistic messages if needed (logic from original)
        // Note: The original logic replaced optimistic messages. 
        // Here we simplify: if it's a "real" message coming in, we just add it.
        // But we need to filter out optimistic versions if they exist.
        
        const cleanedPrev = prev.filter(_ => {
             // If we have a new message that "matches" this one (by content/user/time), 
             // and this one is optimistic (or we just want to replace it with the real one)
             // The duplicate check above PREVENTS adding the new one if the old one exists.
             // But usually we want the Realtime one because it has the true ID/timestamp.
             // For now, let's just stick to appending non-duplicates.
             return true; 
        });

        // Actually, to handle the "Optimistic Update" replacement correctly:
        // The original logic filtered `prev` to remove the optimistic one, then added the new one.
        // My batch logic above simply checks `exists`.
        // Let's refine: If it exists (fuzzy match), we should probably KEEP the existing one 
        // OR replace it. The original logic REPLACED it.
        
        // Let's stick to the simpler "append if not exists" for batching safety first.
        // The "optimistic replacement" is tricky in batch.
        // If the user sees their message instantly, and then the real one comes 500ms later,
        // we ideally want to silent-swap it or just ignore the incoming one if it matches.
        
        return [...cleanedPrev, ...newMessages];
    });

  }, []);

  const channelRef = useRef<any>(null);

  // Listen for new messages
  useEffect(() => {
    if (!streamId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('stream_id', streamId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        const reversed = data.reverse();
        // Fetch profiles for all senders - use user_id consistently
        const uniqueUsers = [...new Set(reversed.map(m => m.user_id))];
        
        // Batch fetch profiles to prevent network saturation
        const missingUserIds = uniqueUsers.filter(uid => uid && !userCacheRef.current[uid]);
        
        if (missingUserIds.length > 0) {
            try {
                // 1. Fetch Profiles
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('id, username, rgb_username_expires_at, avatar_url, is_ghost_mode, role, is_admin, drivers_license_status, is_banned')
                    .in('id', missingUserIds);

                // 2. Fetch Perks
                const { data: perks } = await supabase
                    .from('user_perks')
                    .select('user_id, perk_id')
                    .in('user_id', missingUserIds)
                    .eq('is_active', true);

                // 3. Fetch Insurance
                const { data: insurance } = await supabase
                    .from('user_insurances')
                    .select('user_id, insurance_id')
                    .in('user_id', missingUserIds)
                    .eq('is_active', true)
                    .gt('expires_at', new Date().toISOString());

                // Map results to cache
                missingUserIds.forEach(uid => {
                    const profile = profiles?.find(p => p.id === uid);
                    const userPerks = perks?.filter(p => p.user_id === uid).map(p => p.perk_id) || [];
                    const hasInsurance = insurance?.some(i => i.user_id === uid) || false;

                    userCacheRef.current[uid] = {
                        id: uid,
                        username: profile?.username || 'Unknown Troll',
                        perks: userPerks,
                        hasInsurance,
                        rgbExpiresAt: profile?.rgb_username_expires_at,
                        avatar_url: profile?.avatar_url,
                        is_ghost_mode: profile?.is_ghost_mode,
                        role: profile?.role ?? null,
                        is_admin: profile?.is_admin ?? false,
                        drivers_license_status: profile?.drivers_license_status,
                        is_banned: profile?.is_banned ?? false
                    };
                });
            } catch (err) {
                console.error('Error batch loading profiles:', err);
            }
        }
        
        setMessages(reversed.map(m => ({
          ...m,
          user_id: m.user_id || m.sender_id, // Ensure user_id is always set
          sender_profile: userCacheRef.current[m.user_id || m.sender_id]
        })));
      }
    };

    fetchMessages();

    // Subscribe to new messages (Broadcast + DB fallback)
    const channel = supabase
      .channel(`chat-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Ensure user_id is set
          const msgUserId = newMsg.user_id || (newMsg as any).sender_id;
          if (!msgUserId) return; 

          incomingQueueRef.current.push(newMsg);
          triggerQueueProcessing();
        }
      )
      .on(
        'broadcast',
        { event: 'chat' },
        (payload) => {
          const newMsg = payload.payload as Message;
          // Ensure user_id is set
          const msgUserId = newMsg.user_id || (newMsg as any).sender_id;
          if (!msgUserId) return;
          
          incomingQueueRef.current.push(newMsg);
          triggerQueueProcessing();
        }
      )
      .subscribe();
      
    channelRef.current = channel;

    const triggerQueueProcessing = () => {
        if (processQueueTimeoutRef.current) {
            clearTimeout(processQueueTimeoutRef.current);
        }
        processQueueTimeoutRef.current = setTimeout(() => {
            processIncomingQueue();
        }, 100);
    };

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      if (processQueueTimeoutRef.current) clearTimeout(processQueueTimeoutRef.current);
    };
  }, [streamId, processIncomingQueue]);

  // Auto-remove messages older than 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((prev) => {
        const now = Date.now();
        const hasOld = prev.some(m => now - new Date(m.created_at).getTime() > 30000);
        if (!hasOld) return prev;
        
        return prev.filter((msg) => {
          const age = now - new Date(msg.created_at).getTime();
          return age <= 30000;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check stream-level mute status for current user
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: session } = await supabase.auth.getUser();
        const uid = session.user?.id;
        if (!uid || !streamId) return;
        const { data: sp } = await supabase
          .from('streams_participants')
          .select('can_chat, chat_mute_until')
          .eq('stream_id', streamId)
          .eq('user_id', uid)
          .maybeSingle();
        if (!mounted) return;
        const now = Date.now();
        const mutedUntil = sp?.chat_mute_until ? new Date(sp.chat_mute_until).getTime() : 0;
        const muted = sp?.can_chat === false || mutedUntil > now;
        setIsMuted(Boolean(muted));
      } catch {}
    })();

    // Listen for changes
    // Optimization: Filter by user_id to avoid receiving events for ALL participants in the stream
    // We only care if *our* row changes (mute status update)
    const channel = supabase
      .channel(`sp_mute_${streamId}_${uid || 'anon'}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'streams_participants', filter: `user_id=eq.${uid}` },
        async (payload) => {
          // Verify it's for this stream (though unlikely we're updated in multiple streams simultaneously)
          if (payload.new && (payload.new as any).stream_id === streamId) {
             const newSp = payload.new as any;
             const now = Date.now();
             const mutedUntil = newSp.chat_mute_until ? new Date(newSp.chat_mute_until).getTime() : 0;
             const muted = newSp.can_chat === false || mutedUntil > now;
             setIsMuted(Boolean(muted));
          }
        }
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [streamId, uid]);

  const scrollToBottom = (smooth = true) => {
    const el = chatContainerRef.current;
    if (!el) return;
    const shouldScroll = el.scrollHeight - (el.scrollTop + el.clientHeight) < 200;
    if (suppressAutoScrollRef.current) return;
    if (shouldScroll) {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputValue.trim() === "") return;

    if (isMuted) {
        toast.error("You are muted in this stream.");
        return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to chat');
        return;
      }

      const { error } = await supabase.functions.invoke('officer-actions', {
        body: {
          action: 'send_stream_message',
          streamId,
          content: inputValue,
          messageType: 'chat'
        }
      });

      if (error) throw error;

      const profile = await fetchUserProfile(user.id);
      const optimisticMessage: Message = {
        id: (globalThis.crypto && 'randomUUID' in globalThis.crypto)
          ? (globalThis.crypto as Crypto).randomUUID()
          : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        user_id: user.id,
        content: inputValue,
        message_type: 'chat',
        created_at: new Date().toISOString(),
        sender_profile: profile,
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      setInputValue("");
      suppressAutoScrollRef.current = true;
      setTimeout(() => {
        suppressAutoScrollRef.current = false;
        scrollToBottom();
      }, 300);
    } catch (e) {
      console.error('Failed to send message', e);
      toast.error('Failed to send message');
    }
  };

  const handleUploadImage = async (file: File) => {
    if (!file) return;
    if (isMuted) {
      toast.error("You are muted in this stream.");
      return;
    }
    try {
      setImageUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to chat');
        setImageUploading(false);
        return;
      }
      const ext = file.name.split('.').pop() || 'jpg';
      const name = `${user.id}-${Date.now()}.${ext}`;
      const attempts = [
        { bucket: 'covers', path: `chat/${name}` },
        { bucket: 'profile-avatars', path: `chat/${name}` },
        { bucket: 'public', path: name }
      ];
      let uploadedUrl: string | null = null;
      let lastErr: any = null;
      for (const attempt of attempts) {
        try {
          const { error: uploadErr } = await supabase.storage
            .from(attempt.bucket)
            .upload(attempt.path, file, { cacheControl: '3600', upsert: true });
          if (uploadErr) {
            lastErr = uploadErr;
            continue;
          }
          const { data: urlData } = supabase.storage.from(attempt.bucket).getPublicUrl(attempt.path);
          if (urlData?.publicUrl) {
            uploadedUrl = urlData.publicUrl;
            break;
          }
        } catch (err) {
          lastErr = err;
        }
      }
      if (!uploadedUrl) {
        throw lastErr || new Error('Failed to upload image');
      }

      const profile = await fetchUserProfile(user.id);
      
      const messageId = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
          ? (globalThis.crypto as Crypto).randomUUID()
          : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const optimisticMessage: Message = {
        id: messageId,
        user_id: user.id,
        content: uploadedUrl,
        message_type: 'image',
        created_at: new Date().toISOString(),
        sender_profile: profile,
      };

      // Broadcast
      const channel = supabase.channel(`chat-${streamId}`);
      await channel.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: optimisticMessage
      });

      // Persist
      const { error } = await supabase.functions.invoke('officer-actions', {
        body: {
          action: 'send_stream_message',
          streamId,
          content: uploadedUrl,
          messageType: 'image'
        }
      });
      if (error) {
        throw error;
      }

      setMessages((prev) => [...prev, optimisticMessage]);
      setTimeout(() => scrollToBottom(), 200);
    } catch (e: any) {
      console.error('Image upload failed', e);
      toast.error(e?.message || 'Failed to upload image');
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getUsernameStyle = (perks: string[] = [], rgbExpiresAt?: string) => {
    let classes = "font-bold transition-colors ";
    // Prioritize RGB Username
    if (rgbExpiresAt && new Date(rgbExpiresAt) > new Date()) {
      classes += "rgb-username ";
    } else if (perks.includes('perk_rgb_username')) { // Legacy check
      classes += "rgb-username ";
    } else if (perks.includes('perk_global_highlight')) {
      classes += "text-neon-green drop-shadow-[0_0_5px_rgba(57,255,20,0.8)] ";
    } else {
      classes += "text-purple-300 hover:text-purple-200 ";
    }
    return classes;
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-gradient-to-b from-gray-900 to-black rounded-lg p-[clamp(8px,2.5vw,16px)] purple-neon">
      <h3 className="text-[clamp(11px,3.5vw,14px)] font-bold mb-3">LIVE CHAT</h3>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto overscroll-contain space-y-2 mb-3 min-h-0 pr-2">
        {/** Render messages deduplicated by `id` to avoid duplicate React keys */}
        {useMemo(() => {
          const map = new Map<string, Message>();
          for (const m of messages) {
            if (!m || !m.id) continue;
            if (!map.has(m.id)) map.set(m.id, m);
          }
          return Array.from(map.values()).filter((msg) => {
            // Filter out ghost mode officers
            if ((msg.sender_profile as any)?.is_ghost_mode) return false;
            return true;
          });
        }, [messages]).map((msg) => {
          if (msg.message_type === 'entrance' || msg.message_type === 'system-join') {
            return null;
          }

          if (msg.message_type === 'system' && msg.content === 'ACTION:LIKE') {
             return (
               <div key={msg.id} className="text-xs text-center text-pink-400 italic animate-pulse">
                 {msg.sender_profile?.username} sent a like! ❤️
               </div>
             );
          }

          return (
            <div
              key={msg.id}
              className="text-xs animate-fadeIn rgb-neon rounded p-2 bg-gray-800/50 group hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {msg.sender_profile?.hasInsurance && (
                    <Shield size={12} className="text-blue-400" fill="currentColor" />
                  )}
                  {msg.sender_profile?.perks?.includes('perk_flex_banner') && '👑 '}
                  <ClickableUsername
                    username={msg.sender_profile?.username || 'Unknown'}
                    profile={msg.sender_profile as any}
                    userId={msg.user_id}
                    isBroadcaster={isBroadcaster}
                    streamId={streamId}
                    className={getUsernameStyle(msg.sender_profile?.perks, msg.sender_profile?.rgbExpiresAt)}
                    onClick={() => {
                      const base = msg.sender_profile || { username: 'Unknown' };
                      const payload = { id: msg.user_id, ...base };
                      onProfileClick?.(payload);
                    }}
                  />
                  <UserBadge profile={msg.sender_profile ? { level: 1, ...msg.sender_profile } : undefined} />
                </div>
                <button
                  onClick={() =>
                    setShowCoinInput(showCoinInput === msg.id ? null : msg.id)
                  }
                  className="text-yellow-400 hover:text-yellow-300 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Coins size={14} />
                </button>
              </div>
              {msg.message_type === 'image' ? (
                <img
                  src={msg.content}
                  alt="image"
                  className="mt-1 max-h-64 rounded border border-white/10 object-contain"
                />
              ) : (
                <span className="text-gray-300 break-words">{msg.content}</span>
              )}

              {showCoinInput === msg.id && (
                <div className="mt-2 flex gap-2 items-center">
                  <input
                    type="number"
                    value={coinAmount}
                    onChange={(e) =>
                      setCoinAmount(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-xs"
                    placeholder="Amount"
                  />
                  <button
                    onClick={() => {
                      onCoinSend?.(msg.sender_profile?.username || 'User', coinAmount);
                      setShowCoinInput(null);
                      setCoinAmount(10);
                    }}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-1 rounded text-xs font-bold"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <div className="flex gap-2 sticky bottom-0 bg-gray-900/95 px-1 py-2 -mx-1 sm:static sm:bg-transparent sm:px-0 sm:py-0 sm:mx-0">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            if (f) handleUploadImage(f);
          }}
        />
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={imageUploading}
          className="bg-white/10 hover:bg-white/20 p-2 rounded transition-colors disabled:opacity-60"
        >
          <ImageIcon size={16} />
        </button>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isGlobalBanned ? "You are banned" : isMuted ? "You are muted" : "Type a message..."}
          className="flex-1 bg-white/10 border-none rounded px-3 py-2 text-xs text-white focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          disabled={isMuted || isGlobalBanned}
        />
        <button
          onClick={handleSendMessage}
          disabled={isMuted || isGlobalBanned || !inputValue.trim()}
          className="bg-purple-600 hover:bg-purple-500 p-2 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={16} />
        </button>
      </div>

    </div>
  );
}
