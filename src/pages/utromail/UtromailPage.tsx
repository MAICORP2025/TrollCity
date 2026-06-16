// ============================================================
// UTROMAIL - MESSENGER PAGE (Conversation List + Chat Panel)
// ============================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import {
  Search,
  PenSquare,
  ArrowLeft,
  Send,
  Smile,
  Image,
  Loader2,
  Phone,
  Video,
  X,
  CheckCheck,
  Ban,
  Flag,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  getThreads,
  getMessageRequests,
  getUnreadCount,
  getThreadMessages,
  sendMessage,
  markThreadAsRead,
  markAsRead,
  deleteThread,
  getUtromailAccount,
  blockUser,
  reportMessage,
} from '@/services/utromailService';
import type { UtromailThread, UtromailRequest, UtromailMessage } from '@/types/mail';
import UtromailCompose from './UtromailCompose';
import { toast } from 'sonner';

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getOtherParticipant(thread: UtromailThread, userId: string) {
  // Use the pre-computed flat fields from getThreads (like old TCPS)
  if (thread.other_user_id) {
    return {
      user_id: thread.other_user_id,
      username: thread.other_username || 'Unknown',
      display_name: thread.other_display_name || thread.other_username || 'Unknown',
      avatar_url: thread.other_avatar_url || null,
      utromail_address: thread.other_utromail_address || null,
    };
  }

  // Fallback to members array
  const members = thread.members || [];
  if (members.length === 0) return null;
  const seen = new Set<string>();
  const uniqueMembers = members.filter(m => {
    if (seen.has(m.user_id)) return false;
    seen.add(m.user_id);
    return true;
  });
  const other = uniqueMembers.find(m => m.user_id !== userId);
  return other || uniqueMembers[0] || null;
}

export default function UtromailPage() {
  const navigate = useNavigate();
  const { threadId } = useParams();
  const { user, profile } = useAuthStore();
  const [threads, setThreads] = useState<UtromailThread[]>([]);
  const [requests, setRequests] = useState<UtromailRequest[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userMailAddress, setUserMailAddress] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<{ threadId: string; otherUserId: string; otherUsername: string; x: number; y: number } | null>(null);

  // Chat state
  const [messages, setMessages] = useState<UtromailMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch user's utromail address
  useEffect(() => {
    if (user?.id) {
      getUtromailAccount(user.id).then(account => {
        if (account) {
          setUserMailAddress(account.mail_address);
        }
      });
    }
  }, [user?.id]);

  const senderMail = userMailAddress || `${profile?.username || 'user'}@utromail`;

  const fetchThreadsRef = useRef<() => Promise<void>>();

  const fetchThreads = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [threadsData, requestsData, countData] = await Promise.all([
        getThreads(user.id, 'inbox'),
        getMessageRequests(user.id),
        getUnreadCount(user.id),
      ]);
      setThreads(threadsData);
      setRequests(requestsData);
      setUnreadCount(countData);
    } catch (err) {
      console.error('Error fetching threads:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, refreshKey]);

  // Keep ref updated so realtime subscriptions always have latest version
  fetchThreadsRef.current = fetchThreads;

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId || !user?.id) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setMsgLoading(true);
      try {
        const msgs = await getThreadMessages(activeConversationId);
        setMessages(msgs);
        await markThreadAsRead(activeConversationId, user.id);
        for (const msg of msgs) {
          if (msg.recipient_id === user.id) {
            await markAsRead(msg.id, user.id);
          }
        }
        fetchThreads();
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setMsgLoading(false);
      }
    };

    fetchMessages();
  }, [activeConversationId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Polling fallback: refresh active conversation messages every 30 seconds (reduced frequency)
  useEffect(() => {
    if (!activeConversationId || !user?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const msgs = await getThreadMessages(activeConversationId);
        setMessages(prev => {
          if (msgs.length !== prev.length) return msgs;
          const prevIds = new Set(prev.map(m => m.id));
          const hasNew = msgs.some(m => !prevIds.has(m.id));
          return hasNew ? msgs : prev;
        });
      } catch (err) {
        console.error('Poll fetch error:', err);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [activeConversationId, user?.id]);

  // Polling fallback: refresh thread list every 60 seconds (reduced frequency)
  useEffect(() => {
    if (!user?.id) return;

    const pollInterval = setInterval(() => {
      fetchThreadsRef.current?.();
    }, 60000);

    return () => clearInterval(pollInterval);
  }, [user?.id]);

  const handleSend = async () => {
    if (!replyText.trim() || !activeConversationId || !user) return;
    const activeThread = threads.find(t => t.id === activeConversationId);
    if (!activeThread) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    setSending(true);
    try {
      const recipientId = lastMsg.sender_id === user.id ? lastMsg.recipient_id! : lastMsg.sender_id;
      const recipientMail = lastMsg.sender_id === user.id ? lastMsg.recipient_mail_address! : lastMsg.sender_mail_address;
      await sendMessage({
        senderId: user.id,
        senderMail,
        recipientId,
        recipientMail,
        subject: 'Direct Message',
        body: replyText.trim(),
        parentMessageId: lastMsg.id,
      });
      setReplyText('');
      // Optimistically add the sender's message to the UI immediately
      const optimisticMsg: UtromailMessage = {
        id: `temp-${Date.now()}`,
        thread_id: activeConversationId,
        sender_id: user.id,
        sender_mail_address: senderMail,
        recipientId: recipientId,
        recipientMail,
        subject: 'Direct Message',
        body: replyText.trim(),
        message_type: 'normal',
        is_starred: false,
        is_draft: false,
        parent_message_id: lastMsg.id,
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sender_name: profile?.display_name || profile?.username || null,
        sender_username: profile?.username || null,
        sender_avatar: profile?.avatar_url || null,
      };
      setMessages(prev => [...prev, optimisticMsg]);
      // Then fetch the real messages to replace the optimistic one
      try {
        const freshMsgs = await getThreadMessages(activeConversationId);
        setMessages(freshMsgs);
      } catch (err) {
        console.error('Error refreshing messages after send:', err);
      }
      fetchThreadsRef.current?.();
      toast.success('Sent!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openConversation = (threadId: string) => {
    setActiveConversationId(threadId);
    setShowMobileChat(true);
  };

  const closeMobileChat = () => {
    setShowMobileChat(false);
    setActiveConversationId(null);
  };

  // Real-time: watch for new message notifications for this user
  useEffect(() => {
    if (!user?.id) return;

    const notifChannel = supabase
      .channel(`utromail-notifs:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchThreadsRef.current?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
    };
  }, [user?.id]);

  // Real-time: watch for new messages in the active thread
  useEffect(() => {
    if (!activeConversationId || !user?.id) return;

    const msgChannel = supabase
      .channel(`utromail-thread:${activeConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'utromail_messages',
          filter: `thread_id=eq.${activeConversationId}`,
        },
        async (payload) => {
          try {
            const newMsg = payload.new as any;
            if (!newMsg || newMsg.sender_id === user.id) return;

            // Fetch full message with all fields (realtime payload may not include all columns)
            const { data: fullMsg } = await supabase
              .from('utromail_messages')
              .select('*')
              .eq('id', newMsg.id)
              .maybeSingle();

            const msgData = fullMsg || newMsg;

            const { data: senderProfile } = await supabase
              .from('user_profiles')
              .select('username, display_name, avatar_url')
              .eq('id', msgData.sender_id)
              .maybeSingle();

            const mappedMsg: UtromailMessage = {
              id: msgData.id,
              thread_id: msgData.thread_id,
              sender_id: msgData.sender_id,
              sender_mail_address: msgData.sender_mail_address,
              recipient_id: msgData.recipient_id,
              recipient_mail_address: msgData.recipient_mail_address,
              subject: msgData.subject,
              body: msgData.body,
              body_html: msgData.body_html,
              message_type: msgData.message_type,
              is_starred: false,
              is_draft: false,
              parent_message_id: msgData.parent_message_id,
              sent_at: msgData.sent_at,
              created_at: msgData.created_at,
              updated_at: msgData.updated_at,
              sender_name: (senderProfile as any)?.display_name || (senderProfile as any)?.username || null,
              sender_username: (senderProfile as any)?.username || null,
              sender_avatar: (senderProfile as any)?.avatar_url || null,
            };

            setMessages(prev => {
              if (prev.some(m => m.id === mappedMsg.id)) return prev;
              return [...prev, mappedMsg];
            });

            await markThreadAsRead(activeConversationId, user.id);
            fetchThreadsRef.current?.();
          } catch (err) {
            console.error('[UtromailPage] Realtime message handler error:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [activeConversationId, user?.id]);

  const handleDeleteConversation = async () => {
    if (!activeConversationId || !user?.id) return;
    try {
      await deleteThread(activeConversationId, user.id);
      toast.success('Conversation deleted');
      setThreads(prev => prev.filter(t => t.id !== activeConversationId));
      closeMobileChat();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const activeThread = threads.find(t => t.id === activeConversationId);
  const activeParticipant = activeThread ? getOtherParticipant(activeThread, user?.id || '') : null;

  const filteredThreads = threads.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const lastMsgPreview = t.last_message?.body?.toLowerCase() || '';
    const participant = getOtherParticipant(t, user?.id || '');
    const nameMatch = participant?.display_name?.toLowerCase().includes(q) ||
                      participant?.username?.toLowerCase().includes(q) ||
                      false;
    return lastMsgPreview.includes(q) || nameMatch || t.subject?.toLowerCase().includes(q);
  });

  // Full-screen compose
  if (showCompose) {
    return (
      <UtromailCompose
        onSent={() => { setShowCompose(false); setRefreshKey(k => k + 1); }}
        onCancel={() => setShowCompose(false)}
      />
    );
  }

  const chatPanel = activeConversationId ? (
    <div className="flex h-full flex-col">
      {/* Chat Header */}
      <div className={`${glass} flex items-center justify-between border-b border-white/10 px-4 py-3`}>
        <div className="flex items-center gap-3">
          <button
            onClick={closeMobileChat}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          {activeThread && (
            <>
              <div className="relative">
                {activeThread.other_avatar_url ? (
                  <img src={activeThread.other_avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white">
                    {(activeThread.other_username || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {activeThread.other_username || 'Unknown'}
                </p>
                <p className="text-[10px] text-slate-500">{activeThread.other_utromail_address || 'UTroMail'}</p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <Phone className="h-4 w-4" />
          </button>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <Video className="h-4 w-4" />
          </button>
          <button
            onClick={handleDeleteConversation}
            className="rounded-lg p-2 text-slate-400 hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#050810] to-[#070b19] p-4">
        {msgLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => {
              const isOwn = msg.sender_id === user?.id;
              const showAvatar = !isOwn && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);
              const isLast = idx === messages.length - 1 || messages[idx + 1].sender_id !== msg.sender_id;

              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isOwn && (
                    <div className="w-8 shrink-0">
                      {showAvatar && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-black text-white">
                          {(msg.sender_name || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 ${
                        isOwn
                          ? 'rounded-br-md bg-emerald-500/20 text-white'
                          : 'rounded-bl-md bg-white/5 text-white'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.body}</p>
                    </div>
                    {isLast && (
                      <p className={`mt-1 text-[9px] text-slate-500 ${isOwn ? 'text-right' : 'text-left'}`}>
                        {formatMessageTime(msg.sent_at)}
                        {isOwn && <CheckCheck className="ml-1 inline h-3 w-3 text-emerald-400" />}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={`${glass} border-t border-white/10 p-3`}>
        <div className="flex items-end gap-2">
          <button className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <Image className="h-5 w-5" />
          </button>
          <button className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <Smile className="h-5 w-5" />
          </button>
          <textarea
            ref={inputRef}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none placeholder-slate-500 focus:border-emerald-400/50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !replyText.trim()}
            className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-2.5 text-white transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-600/20">
        <Send className="h-8 w-8 text-emerald-400" />
      </div>
      <h2 className="text-lg font-bold text-white">Your Messages</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-400">
        Select a conversation to start chatting
      </p>
    </div>
  );

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col p-4">
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left Sidebar - Conversation List */}
        <div className={`${glass} flex w-full shrink-0 flex-col rounded-2xl lg:w-[350px] min-h-0 ${showMobileChat ? 'hidden lg:flex' : 'flex'}`}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <h1 className="text-lg font-black text-white">Messages</h1>
            <button
              onClick={() => setShowCompose(true)}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-2 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] transition hover:scale-105"
            >
              <PenSquare className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-400/50"
              />
            </div>
          </div>

          {/* Message Requests Banner */}
          {requests.length > 0 && (
            <div className="px-4 pb-2">
              <button
                onClick={() => navigate('/utromail/requests')}
                className="flex w-full items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-left transition hover:bg-amber-500/20"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-sm font-black text-amber-300">
                  !
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-amber-300">Message Requests</p>
                  <p className="text-[10px] text-amber-400/70">{requests.length} pending</p>
                </div>
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
                  {requests.length}
                </span>
              </button>
            </div>
          )}

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400">No conversations yet</p>
                <button
                  onClick={() => setShowCompose(true)}
                  className="mt-3 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                >
                  Start a new conversation
                </button>
              </div>
            ) : (
              <div className="space-y-0.5 p-2">
                {filteredThreads.map(thread => {
                  const lastMsg = thread.last_message;
                  const isActive = activeConversationId === thread.id;
                  const isUnread = thread.unread_count ? thread.unread_count > 0 : false;
                  // Use flat fields from getThreads (same pattern as old TCPS InboxSidebar)
                  const displayName = thread.other_username || 'Unknown';
                  const avatarUrl = thread.other_avatar_url;
                  const avatarLetter = displayName !== 'Unknown' ? displayName[0].toUpperCase() : '?';
                  return (
                    <button
                      key={thread.id}
                      onClick={() => openConversation(thread.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (thread.other_user_id) {
                          setContextMenu({
                            threadId: thread.id,
                            otherUserId: thread.other_user_id,
                            otherUsername: thread.other_username || 'Unknown',
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }
                      }}
                      onTouchStart={(e) => {
                        // Long-press detection for mobile
                        const touch = e.touches[0];
                        const timer = setTimeout(() => {
                          if (thread.other_user_id) {
                            setContextMenu({
                              threadId: thread.id,
                              otherUserId: thread.other_user_id,
                              otherUsername: thread.other_username || 'Unknown',
                              x: touch.clientX,
                              y: touch.clientY,
                            });
                          }
                        }, 600);
                        const cleanup = () => clearTimeout(timer);
                        e.currentTarget.addEventListener('touchend', cleanup, { once: true });
                        e.currentTarget.addEventListener('touchmove', cleanup, { once: true });
                      }}
                      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                        isActive
                          ? 'bg-emerald-500/15'
                          : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="shrink-0">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white">
                            {avatarLetter}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className={`truncate text-sm ${isUnread ? 'font-black text-white' : 'font-bold text-slate-200'}`}>
                            {displayName}
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-500">
                            {thread.last_message_at ? formatTime(thread.last_message_at) : ''}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <p className="truncate text-xs text-slate-400">
                            {lastMsg?.body || 'No messages yet'}
                          </p>
                          {isUnread && (
                            <span className="ml-2 shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-white">
                              {thread.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Chat Panel */}
        <div className={`${glass} flex flex-1 flex-col overflow-hidden rounded-2xl min-h-0 ${showMobileChat ? 'flex' : 'hidden lg:flex'}`}>
          {chatPanel}
        </div>
      </div>

      {/* Thread Context Menu Modal */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-[999]"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-[1000] min-w-[200px] rounded-xl border border-white/10 bg-[#0d1117] py-1 shadow-2xl"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 220),
              top: Math.min(contextMenu.y, window.innerHeight - 200),
            }}
          >
            <div className="border-b border-white/10 px-4 py-2">
              <p className="text-xs font-bold text-slate-400">Thread with {contextMenu.otherUsername}</p>
            </div>
            <button
              onClick={async () => {
                try {
                  await blockUser(user!.id, contextMenu.otherUserId);
                  toast.success(`Blocked ${contextMenu.otherUsername}`);
                  setContextMenu(null);
                  fetchThreadsRef.current?.();
                } catch (err: any) {
                  toast.error(err.message || 'Failed to block user');
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-500/10"
            >
              <Ban className="h-4 w-4" />
              Block User
            </button>
            <button
              onClick={async () => {
                const reason = prompt('Report reason:');
                if (!reason?.trim()) return;
                try {
                  await reportMessage(contextMenu.otherUserId, contextMenu.threadId, reason.trim());
                  toast.success('Report submitted');
                  setContextMenu(null);
                } catch (err: any) {
                  toast.error(err.message || 'Failed to submit report');
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-amber-400 transition hover:bg-amber-500/10"
            >
              <Flag className="h-4 w-4" />
              Report Thread
            </button>
            <button
              onClick={async () => {
                try {
                  await deleteThread(contextMenu.threadId, user!.id);
                  toast.success('Thread removed from inbox');
                  setContextMenu(null);
                  if (activeConversationId === contextMenu.threadId) {
                    setActiveConversationId(null);
                    setShowMobileChat(false);
                  }
                  fetchThreadsRef.current?.();
                } catch (err: any) {
                  toast.error(err.message || 'Failed to remove thread');
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 transition hover:bg-white/5"
            >
              <Trash2 className="h-4 w-4" />
              Remove from Inbox
            </button>
          </div>
        </>
      )}
    </div>
  );
}
