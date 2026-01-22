import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  avatarUrl?: string | null;
}

interface ChatBottomSheetProps {
  messages: Message[];
  unreadCount?: number;
  onSendMessage: (content: string) => void;
  onClose: () => void;
  isOpen: boolean;
  className?: string;
}

export default function ChatBottomSheet({
  messages,
  unreadCount: _unreadCount = 0,
  onSendMessage,
  onClose,
  isOpen,
  className = ''
}: ChatBottomSheetProps) {
  const [inputValue, setInputValue] = useState('');
  const [rows, setRows] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-grow textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const textareaLineHeight = 20;
    const minRows = 1;
    const maxRows = 3;
    const newRows =
      Math.min(
        Math.max(
          Math.ceil(e.target.scrollHeight / textareaLineHeight),
          minRows
        ),
        maxRows
      ) || minRows;
    setRows(newRows);
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
      setRows(1);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div className="broadcast-drawer-overlay" onClick={onClose} />

      {/* Sheet */}
      <div className={`broadcast-chat-sheet ${className}`}>
        <div className="broadcast-chat-sheet-content">
          {/* Handle / Drag Bar */}
          <div className="broadcast-chat-sheet-handle">
            <div className="broadcast-chat-sheet-handle-bar"></div>
          </div>

          {/* Header */}
          <div className="broadcast-chat-sheet-header">
            <h2 className="broadcast-chat-sheet-title">Chat</h2>
            <button
              className="broadcast-chat-sheet-close"
              onClick={onClose}
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="broadcast-chat-messages">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <MessageCircle
                  size={32}
                  className="text-purple-400 opacity-30"
                />
                <p className="text-sm text-gray-400">No messages yet</p>
                <p className="text-xs text-gray-500">Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="broadcast-chat-message">
                  <div className="broadcast-chat-message-user">{msg.username}</div>
                  <div className="broadcast-chat-message-text">{msg.content}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="broadcast-chat-input-area">
            <textarea
              ref={inputRef}
              className="broadcast-chat-input"
              placeholder="Type a message..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              rows={rows}
            />
            <button
              className="broadcast-chat-send-btn"
              onClick={handleSend}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
