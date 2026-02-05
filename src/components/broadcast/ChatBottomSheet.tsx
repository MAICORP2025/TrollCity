import React, { useRef, useEffect } from 'react';
import { Send, Smile } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ChatMessage } from '../../types/broadcast';

interface ChatBottomSheetProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isOpen?: boolean; // If we want to support collapse
  className?: string;
}

export default function ChatBottomSheet({
  messages,
  onSendMessage,
  className
}: ChatBottomSheetProps) {
  const [inputValue, setInputValue] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue('');
  };

  return (
    <div className={cn("flex flex-col h-[300px] w-full max-w-md pointer-events-auto", className)}>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2 mask-image-linear-gradient">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col items-start animate-fade-in-up">
            <div className="bg-black/30 backdrop-blur-sm rounded-2xl rounded-tl-sm px-3 py-1.5 max-w-[85%] border border-white/5">
              <span className="text-[11px] font-bold text-pink-400 block mb-0.5">
                {msg.user?.username || 'User'}
              </span>
              <p className="text-sm text-white leading-snug break-words">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 pb-safe-bottom">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Say something..."
              className="w-full bg-black/40 backdrop-blur-md border border-white/10 rounded-full py-2.5 pl-4 pr-10 text-white placeholder-white/50 text-sm focus:outline-none focus:border-pink-500/50 transition-colors"
            />
            <button 
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
            >
              <Smile size={18} />
            </button>
          </div>
          
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            <Send size={18} className={inputValue.trim() ? "ml-0.5" : ""} />
          </button>
        </form>
      </div>
    </div>
  );
}
