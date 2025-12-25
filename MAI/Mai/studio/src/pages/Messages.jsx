import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { supabase} from '@/api/supabaseclient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  MessageCircle, Send, Search, User, 
  Trash2, Mail, MailOpen, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Messages() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageContent, setMessageContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await supabase.auth.me();
        setCurrentUser(userData);
      } catch {
        supabase.auth.redirectToLogin();
      }
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const { data: allMessages = [] } = useQuery({
    queryKey: ['messages', currentUser?.email],
    queryFn: async () => {
      const sent = await supabase.entities.Message.filter({ from_email: currentUser.email }, '-created_date');
      const received = await supabase.entities.Message.filter({ to_email: currentUser.email }, '-created_date');
      return [...sent, ...received].sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );
    },
    enabled: !!currentUser?.email,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Group messages by conversation
  const conversations = React.useMemo(() => {
    if (!allMessages.length) return [];
    
    const convMap = new Map();
    
    allMessages.forEach(msg => {
      const conversationId = msg.conversation_id;
      if (!convMap.has(conversationId)) {
        const otherEmail = msg.from_email === currentUser.email ? msg.to_email : msg.from_email;
        convMap.set(conversationId, {
          id: conversationId,
          otherEmail,
          messages: [],
          lastMessage: msg,
          unreadCount: 0
        });
      }
      
      const conv = convMap.get(conversationId);
      conv.messages.push(msg);
      
      if (msg.to_email === currentUser.email && !msg.is_read) {
        conv.unreadCount++;
      }
    });
    
    return Array.from(convMap.values()).sort((a, b) => 
      new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date)
    );
  }, [allMessages, currentUser]);

  const selectedMessages = selectedConversation 
    ? conversations.find(c => c.id === selectedConversation)?.messages || []
    : [];

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (selectedConversation) {
      const conv = conversations.find(c => c.id === selectedConversation);
      if (conv) {
        conv.messages.forEach(async (msg) => {
          if (msg.to_email === currentUser.email && !msg.is_read) {
            await supabase.entities.Message.update(msg.id, { is_read: true });
          }
        });
        queryClient.invalidateQueries(['messages']);
      }
    }
  }, [selectedConversation, conversations, currentUser.email, queryClient]);

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !selectedConversation) return;

    const conv = conversations.find(c => c.id === selectedConversation);
    if (!conv) return;

    try {
      await supabase.entities.Message.create({
        from_email: currentUser.email,
        to_email: conv.otherEmail,
        content: messageContent,
        conversation_id: selectedConversation
      });
      setMessageContent('');
      queryClient.invalidateQueries(['messages']);
    } catch {
      toast.error('Failed to send message');
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!confirm('Delete this conversation?')) return;

    try {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        for (const msg of conv.messages) {
          await supabase.entities.Message.delete(msg.id);
        }
      }
      setSelectedConversation(null);
      queryClient.invalidateQueries(['messages']);
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-xl bg-[#FFD700]/20">
            <MessageCircle className="w-8 h-8 text-[#FFD700]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Messages</h1>
            <p className="text-gray-400">Connect with other users</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Conversations List */}
          <div className="md:col-span-1">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/50 overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
              </div>
              
              <div className="max-h-[600px] overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <Mail className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-400">No conversations yet</p>
                  </div>
                ) : (
                  conversations
                    .filter(c => c.otherEmail.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv.id)}
                        className={`w-full p-4 border-b border-gray-800 hover:bg-gray-800/50 transition-colors text-left ${
                          selectedConversation === conv.id ? 'bg-gray-800/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#FFD700]/20 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-[#FFD700]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-white truncate">{conv.otherEmail.split('@')[0]}</p>
                              {conv.unreadCount > 0 && (
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-[#FF1744] text-white text-xs">
                                  {conv.unreadCount}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-400 truncate">{conv.lastMessage.content}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {format(new Date(conv.lastMessage.created_date), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </div>
          </div>

          {/* Message Thread */}
          <div className="md:col-span-2">
            {!selectedConversation ? (
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50 h-[600px] flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400">Select a conversation to view messages</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-800 bg-gray-900/50 h-[600px] flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="md:hidden text-gray-400 hover:text-white"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-[#FFD700]/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-[#FFD700]" />
                    </div>
                    <div>
                      <Link 
                        to={createPageUrl(`UserProfile?user=${conversations.find(c => c.id === selectedConversation)?.otherEmail}`)}
                        className="font-medium text-white hover:text-[#FFD700]"
                      >
                        {conversations.find(c => c.id === selectedConversation)?.otherEmail.split('@')[0]}
                      </Link>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteConversation(selectedConversation)}
                    className="text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {selectedMessages
                    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
                    .map((msg) => {
                      const isOwn = msg.from_email === currentUser.email;
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                            isOwn 
                              ? 'bg-[#FFD700] text-black' 
                              : 'bg-gray-800 text-white'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${isOwn ? 'text-black/70' : 'text-gray-500'}`}>
                              {format(new Date(msg.created_date), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-800">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type a message..."
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="bg-gray-800 border-gray-700 text-white resize-none h-12"
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!messageContent.trim()}
                      className="neon-btn-gold text-black"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}