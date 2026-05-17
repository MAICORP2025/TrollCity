import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageCircle, X, Send } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

interface TCPSMessageBubbleProps {
  broadcasterId: string;
}

interface TCPSMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender_profile?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function TCPSMessageBubble({ broadcasterId }: TCPSMessageBubbleProps) {
  const [messages, setMessages] = useState<TCPSMessage[]>([]);
  const [showBubble, setShowBubble] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<TCPSMessage | null>(null);
  const [replyText, setReplyText] = useState('');
  const navigate = useNavigate();
  const hasNewMessageRef = useRef(false);

  useEffect(() => {
    if (!broadcasterId) return;

    // Subscribe to TCPS messages for this user
    const channel = supabase
      .channel(`tcps-broadcast-notify:${broadcasterId}`)
      .on('broadcast', { event: 'new_tcps_message' }, (payload) => {
        const message = payload.payload as TCPSMessage;
        // Only show if sender is not the broadcaster themselves
        if (message.sender_id !== broadcasterId) {
          setCurrentMessage(message);
          setShowBubble(true);
          hasNewMessageRef.current = true;
          
          // Auto-hide after 15 seconds if not clicked
          setTimeout(() => {
            setShowBubble(false);
          }, 15000);
        }
      })
      .subscribe();

    // Also poll for recent unread messages every 30 seconds
    const fetchUnread = async () => {
      const { data } = await supabase
        .from('tcps_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at
        `)
        .neq('sender_id', broadcasterId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !hasNewMessageRef.current) {
        setCurrentMessage(data as any);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [broadcasterId]);

  const handleReply = async () => {
    if (!replyText.trim() || !currentMessage) return;

    // Navigate to TCPS with the conversation
    navigate(`/tcps?user=${currentMessage.sender_id}`);
  };

  const handleViewMessages = () => {
    navigate('/tcps');
  };

  if (!showBubble || !currentMessage) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 animate-slide-up">
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-72 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-white/5">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">
              New Message
            </span>
          </div>
          <button
            onClick={() => setShowBubble(false)}
            className="text-white/50 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        {/* Message Content */}
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
              {(currentMessage as any).sender_profile?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-[11px] font-bold text-white">
                {(currentMessage as any).sender_profile?.username || 'Unknown'}
              </p>
              <p className="text-[9px] text-white/50">sent you a message</p>
            </div>
          </div>

          <div className="bg-white/5 rounded-lg px-3 py-2 mb-3">
            <p className="text-xs text-white/80 line-clamp-2">
              {currentMessage.content}
            </p>
          </div>

          {/* Quick Reply Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Quick reply..."
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/30"
              onKeyDown={(e) => e.key === 'Enter' && handleReply()}
            />
            <button
              onClick={handleReply}
              disabled={!replyText.trim()}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                replyText.trim() 
                  ? "bg-purple-600 text-white" 
                  : "bg-white/10 text-white/30"
              )}
            >
              <Send size={12} />
            </button>
          </div>

          {/* View All Messages Link */}
          <button
            onClick={handleViewMessages}
            className="w-full mt-2 text-[10px] text-purple-400 hover:text-purple-300 text-center"
          >
            View in TCPS →
          </button>
        </div>
      </div>
    </div>
  );
}