import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import MessageInput from './MessageInput';
import { useParams } from 'react-router-dom';
import { Message } from '@/types/db';

const MAX_MESSAGES = 100;

const ChatWindow = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const profile = useAuthStore(state => state.profile);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          content,
          created_at,
          read_at,
          sender:profiles (
            username,
            avatar_url,
            rgb_username_expires_at,
            glowing_username_color
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(MAX_MESSAGES);

      if (error) {
        console.error('Error fetching messages:', error);
      } else if (data) {
        const formattedMessages: Message[] = data.map(msg => ({
          ...msg,
          sender_username: msg.sender.username,
          sender_avatar_url: msg.sender.avatar_url,
          sender_rgb_expires_at: msg.sender.rgb_username_expires_at,
          sender_glowing_username_color: msg.sender.glowing_username_color,
        }));
        setMessages(formattedMessages);
      }
    };

    fetchMessages();

  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase.channel(`chat:${conversationId}`);

    const handleNewMessage = (payload: any) => {
      const newMessage = payload.new || payload.payload;
      setMessages(prev => {
        // Replace temp message with final one from DB
        if (prev.some(m => m.id === newMessage.id)) {
          return prev.map(m => m.id === newMessage.id ? newMessage : m);
        }
        // Add new message if not already present
        const updated = [...prev, newMessage];
        if (updated.length > MAX_MESSAGES) {
          return updated.slice(updated.length - MAX_MESSAGES);
        }
        return updated;
      });
    };

    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, handleNewMessage)
      .on('broadcast', { event: 'new-message' }, handleNewMessage)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    if (virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
    }
  }, [messages]);

  const handleNewMessageOptimistic = (msg: Message) => {
    setMessages(prev => {
      // Prevent duplicates
      if (prev.some(m => m.id === msg.id)) return prev;
      const updated = [...prev, msg];
      if (updated.length > MAX_MESSAGES) return updated.slice(updated.length - MAX_MESSAGES);
      return updated;
    });
    setTimeout(() => {
      if (virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({ index: 'last', behavior: 'smooth' });
      }
    }, 50);
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow">
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          itemContent={(index, msg) => (
            <div key={msg.id} className="p-4">
              <strong>{msg.sender_username}: </strong>
              <span>{msg.content}</span>
            </div>
          )}
        />
      </div>
      <MessageInput conversationId={conversationId!} onNewMessage={handleNewMessageOptimistic} />
    </div>
  );
};

export default ChatWindow;
