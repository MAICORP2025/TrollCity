// ============================================================
// UTROMAIL - MESSENGER CHAT VIEW (Standalone Page)
// ============================================================

import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import {
  ArrowLeft,
  Send,
  Smile,
  Image,
  Loader2,
  MoreVertical,
  Phone,
  Video,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { getThreadMessages, sendMessage, markAsRead, markThreadAsRead, deleteThread, getUtromailAccount } from '@/services/utromailService';
import type { UtromailMessage } from '@/types/mail';
import { toast } from 'sonner';

interface Props {
  threadId: string;
  onBack: () => void;
  onRefresh: () => void;
}

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function UtromailThreadView({ threadId, onBack, onRefresh }: Props) {
  const { user, profile } = useAuthStore();
  const [messages, setMessages] = useState<UtromailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [userMailAddress, setUserMailAddress] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const senderMail = userMailAddress || `${profile?.username || 'user'}@utromail`;

  useEffect(() => {
    if (user?.id) {
      getUtromailAccount(user.id).then(account => {
        if (account) {
          setUserMailAddress(account.mail_address);
        }
      });
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMessages();
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const msgs = await getThreadMessages(threadId);
      setMessages(msgs);
      await markThreadAsRead(threadId, user!.id);
      for (const msg of msgs) {
        if (msg.recipient_id === user!.id) {
          await markAsRead(msg.id, user!.id);
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!replyText.trim()) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;

    setSending(true);
    try {
      await sendMessage({
        senderId: user!.id,
        senderMail,
        recipientId: lastMsg.sender_id === user!.id ? lastMsg.recipient_id! : lastMsg.sender_id,
        recipientMail: lastMsg.sender_id === user!.id ? lastMsg.recipient_mail_address! : lastMsg.sender_mail_address,
        subject: 'Direct Message',
        body: replyText.trim(),
        parentMessageId: lastMsg.id,
      });
      setReplyText('');
      await fetchMessages();
      onRefresh();
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

  const handleDelete = async () => {
    try {
      await deleteThread(threadId, user!.id);
      toast.success('Conversation deleted');
      onBack();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const otherParticipant = messages.find(m => m.sender_id !== user?.id);
  const participantName = otherParticipant?.sender_name || 'Unknown';
  const participantAvatar = otherParticipant?.sender_avatar;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-80px)] max-w-4xl flex-col p-4">
      {/* Chat Header */}
      <div className={`${glass} flex items-center justify-between rounded-t-2xl border-b border-white/10 px-4 py-3`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white">
              {participantAvatar ? (
                <img src={participantAvatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                (participantName[0] || '?').toUpperCase()
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#070b19] bg-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{participantName}</p>
            <p className="text-[10px] text-emerald-400">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <Phone className="h-4 w-4" />
          </button>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <Video className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-white/10 bg-[#0d1117] py-1 shadow-xl">
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.06]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete conversation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#050810] to-[#070b19] p-4">
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
                        {msg.sender_avatar ? (
                          <img src={msg.sender_avatar} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          (msg.sender_name || '?')[0].toUpperCase()
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className={`max-w-[75%]`}>
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
      </div>

      {/* Input Area */}
      <div className={`${glass} rounded-b-2xl border-t border-white/10 p-3`}>
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
  );
}
