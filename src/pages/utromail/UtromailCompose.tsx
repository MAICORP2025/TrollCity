// ============================================================
// UTROMAIL - NEW CONVERSATION (Messenger Style)
// ============================================================

import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import {
  Send,
  X,
  Loader2,
  ArrowLeft,
  Smile,
  Image,
} from 'lucide-react';
import { sendMessage, searchUsers, getUtromailAccount } from '@/services/utromailService';
import type { MailSearchResult } from '@/types/mail';
import { toast } from 'sonner';

interface Props {
  onSent: () => void;
  onCancel: () => void;
  replyTo?: { threadId?: string; recipientMail?: string; subject?: string; recipientId?: string };
}

const glass = 'border border-white/10 bg-[#070b19]/70 backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)]';

export default function UtromailCompose({ onSent, onCancel, replyTo }: Props) {
  const { user, profile } = useAuthStore();
  const [toSearch, setToSearch] = useState('');
  const [searchResults, setSearchResults] = useState<MailSearchResult['users']>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; name: string; mail: string } | null>(
    replyTo?.recipientId ? { id: replyTo.recipientId, name: replyTo.recipientMail || '', mail: replyTo.recipientMail || '' } : null
  );
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [userMailAddress, setUserMailAddress] = useState<string>('');
  const searchRef = useRef<HTMLDivElement>(null);
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
    const delay = setTimeout(async () => {
      if (toSearch.length >= 2 && !selectedRecipient) {
        try {
          const results = await searchUsers(toSearch);
          setSearchResults(results);
          setShowSearch(true);
        } catch {
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [toSearch, selectedRecipient]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSend = async () => {
    if (!selectedRecipient && !toSearch.includes('@')) {
      toast.error('Please select a recipient');
      return;
    }
    if (!body.trim()) {
      toast.error('Please enter a message');
      return;
    }
    setSending(true);
    try {
      await sendMessage({
        senderId: user!.id,
        senderMail,
        recipientId: selectedRecipient?.id,
        recipientMail: selectedRecipient?.mail || toSearch,
        subject: 'Direct Message',
        body: body.trim(),
        parentMessageId: replyTo?.threadId,
      });
      toast.success('Message sent!');
      onSent();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      {/* Header */}
      <div className={`${glass} flex items-center justify-between rounded-t-2xl border-b border-white/10 px-4 py-3`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-black text-white">New Conversation</h2>
        </div>
        <button
          onClick={onCancel}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Recipient Search */}
      <div className={`${glass} border-b border-white/10 p-4`} ref={searchRef}>
        <div className="flex items-center gap-2">
          <span className="w-16 text-xs font-bold text-slate-400">To:</span>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {selectedRecipient && (
              <span className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/30 text-[10px] font-black">
                  {selectedRecipient.name[0]?.toUpperCase()}
                </div>
                {selectedRecipient.name}
                <button onClick={() => { setSelectedRecipient(null); setToSearch(''); }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            {!selectedRecipient && (
              <input
                type="text"
                value={toSearch}
                onChange={e => setToSearch(e.target.value)}
                placeholder="Search for a user..."
                className="min-w-[200px] flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500"
                autoFocus
              />
            )}
          </div>
        </div>

        {/* Search Results Dropdown */}
        {showSearch && searchResults.length > 0 && (
          <div className="absolute left-20 right-4 z-50 mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#0d1117] shadow-xl">
            {searchResults.map(u => (
              <button
                key={u.id}
                onClick={() => {
                  setSelectedRecipient({ id: u.id, name: u.display_name || u.username, mail: u.utromail_address });
                  setToSearch('');
                  setShowSearch(false);
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.06]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-black text-white">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    (u.display_name || u.username)[0].toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{u.display_name || u.username}</p>
                  <p className="truncate text-xs text-slate-400">
                    {u.utromail_address}
                    {u.is_staff && <span className="ml-1 text-emerald-400">🛡️ Staff</span>}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Message Preview (when recipient selected) */}
      {selectedRecipient && (
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#050810] to-[#070b19] p-4">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-black text-white">
              {selectedRecipient.name[0]?.toUpperCase()}
            </div>
            <p className="mt-3 text-lg font-bold text-white">{selectedRecipient.name}</p>
            <p className="text-xs text-slate-400">{selectedRecipient.mail}</p>
            <p className="mt-2 text-xs text-slate-500">Start a new conversation</p>
          </div>
        </div>
      )}

      {/* Empty state when no recipient */}
      {!selectedRecipient && (
        <div className="flex-1 bg-gradient-to-b from-[#050810] to-[#070b19]" />
      )}

      {/* Message Input */}
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
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your first message..."
            rows={2}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white outline-none placeholder-slate-500 focus:border-emerald-400/50"
          />
          <button
            onClick={handleSend}
            disabled={sending || !body.trim() || !selectedRecipient}
            className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 p-2.5 text-white transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
