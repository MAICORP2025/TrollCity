import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, MessageSquare, X, Search, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Message {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
}

interface Conversation {
  id: string;
  other_user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
  };
  last_read_at: string;
  last_message?: Message;
}

export default function Messages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/messages/conversations');
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch {
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/messages/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() || !selectedConversation) return;

    setIsSending(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: messageContent,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json();

      if (data.requires_payment) {
        // Show payment dialog
        setPendingMessage(data.message);
        setPaymentAmount(data.payment_amount);
        setShowPaymentDialog(true);
        setMessageContent(''); // Clear input but keep message in pending state
      } else {
        // Message sent successfully
        setMessages([...messages, data.message]);
        setMessageContent('');
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!pendingMessage || !selectedConversation) return;

    setIsProcessingPayment(true);
    try {
      // Get creator ID from the conversation
      const creatorResponse = await fetch(`/api/creator/${selectedConversation.other_user.id}`);
      if (!creatorResponse.ok) throw new Error('Failed to get creator info');

      const creatorData = await creatorResponse.json();

      const paymentResponse = await fetch('/api/messages/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: pendingMessage.id,
          creatorId: creatorData.id,
          coinAmount: paymentAmount,
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.error || 'Payment failed');
      }

      // Payment successful, add message to UI
      setMessages([...messages, pendingMessage]);
      setShowPaymentDialog(false);
      setPendingMessage(null);
      toast.success('Message sent successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Payment failed');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCancelPayment = () => {
    setShowPaymentDialog(false);
    setPendingMessage(null);
    setPaymentAmount(0);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;

    try {
      const response = await fetch(`/api/messages/${conversationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete conversation');

      setConversations(conversations.filter((c) => c.id !== conversationId));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      toast.success('Conversation deleted');
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.other_user.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4">
        <div className="container-wide h-[calc(100vh-140px)] max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            {/* Conversations List */}
            <div className="card-glow rounded-lg border border-white/10 flex flex-col">
              <div className="p-4 border-b border-white/10">
                <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <MessageSquare size={24} />
                  Messages
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white/10 border border-white/20 text-white"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="animate-spin text-yellow-400" size={24} />
                  </div>
                ) : filteredConversations.length > 0 ? (
                  <div className="divide-y divide-white/10">
                    {filteredConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => handleSelectConversation(conversation)}
                        className={`w-full text-left p-4 transition ${
                          selectedConversation?.id === conversation.id
                            ? 'bg-yellow-400/10 border-l-2 border-yellow-400'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-semibold text-white">
                            {conversation.other_user.display_name}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-1">
                          {conversation.last_message?.content || 'No messages yet'}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-gray-400">
                    {searchQuery ? 'No conversations found' : 'No conversations yet'}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className="card-glow rounded-lg border border-white/10 flex flex-col md:col-span-2">
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {selectedConversation.other_user.display_name}
                      </h3>
                      <p className="text-xs text-gray-400">
                        @{selectedConversation.other_user.username}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteConversation(selectedConversation.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition text-red-400"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="animate-spin text-yellow-400" size={24} />
                      </div>
                    ) : messages.length > 0 ? (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.sender_id === user?.id
                              ? 'justify-end'
                              : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              message.sender_id === user?.id
                                ? 'bg-yellow-400/20 text-yellow-100'
                                : 'bg-white/10 text-white'
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <p
                              className={`text-xs mt-1 ${
                                message.sender_id === user?.id
                                  ? 'text-yellow-400/70'
                                  : 'text-gray-400'
                              }`}
                            >
                              {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-32 text-gray-400">
                        No messages yet
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-white/10 flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="bg-white/10 border border-white/20 text-white"
                      disabled={isSending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={isSending || !messageContent.trim()}
                      className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold flex items-center gap-2"
                    >
                      {isSending ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <Send size={18} />
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <MessageSquare className="mx-auto mb-3 text-gray-500" size={48} />
                    <p>Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="text-yellow-400" size={24} />
              Pay for Message
            </DialogTitle>
            <DialogDescription>
              This creator charges {paymentAmount} coins to send messages. Your current balance will be updated after payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-white">Message Cost:</span>
                <span className="text-yellow-400 font-semibold flex items-center gap-1">
                  <Coins size={16} />
                  {paymentAmount}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-white">Your Balance:</span>
                <span className="text-white font-semibold flex items-center gap-1">
                  <Coins size={16} />
                  {user?.coin_balance || 0}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
                <span className="text-white">After Payment:</span>
                <span className={`font-semibold flex items-center gap-1 ${
                  (user?.coin_balance || 0) - paymentAmount >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  <Coins size={16} />
                  {(user?.coin_balance || 0) - paymentAmount}
                </span>
              </div>
            </div>

            {(user?.coin_balance || 0) < paymentAmount && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">
                  Insufficient coins. You need {paymentAmount - (user?.coin_balance || 0)} more coins to send this message.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleCancelPayment}
                variant="outline"
                className="flex-1"
                disabled={isProcessingPayment}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmPayment}
                disabled={isProcessingPayment || (user?.coin_balance || 0) < paymentAmount}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              >
                {isProcessingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Coins className="mr-2 h-4 w-4" />
                    Pay & Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
