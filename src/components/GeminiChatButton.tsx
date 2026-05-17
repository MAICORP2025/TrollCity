import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, GitBranch, Terminal, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function GeminiChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Hello! I am your Gemini Code Assistant. I can help you modify code and push changes to Git.' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    // Mock response logic simulation
    setTimeout(() => {
      const userCmd = userMsg.toLowerCase();
      let response = "I've received your request.";
      
      if (userCmd.includes('code') || userCmd.includes('change') || userCmd.includes('fix')) {
        // Simulate code generation delay
        setTimeout(() => {
            toast.success('Code modifications applied successfully!');
            setMessages(prev => [
                ...prev, 
                { role: 'assistant', content: 'I have analyzed the request and applied the necessary code changes to the local files.' }
            ]);
            setIsTyping(false);
        }, 2000);
        response = "Analyzing codebase and applying changes...";
      } else if (userCmd.includes('git') || userCmd.includes('push')) {
        // Simulate git operation
        setTimeout(() => {
            toast.success('Changes pushed to origin/main');
            setMessages(prev => [
                ...prev, 
                { role: 'assistant', content: 'Successfully committed and pushed changes to the remote repository using environment credentials.' }
            ]);
            setIsTyping(false);
        }, 2500);
        response = "Preparing to push changes to Git...";
      } else {
          response = "I can help with coding tasks. Try asking me to 'change the car color' or 'push to git'.";
          setIsTyping(false);
      }
      
      if (response !== "Analyzing codebase and applying changes..." && response !== "Preparing to push changes to Git...") {
          setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      }
    }, 1000);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg hover:scale-110 transition-transform group border border-white/20"
        title="Gemini Code Assistant"
      >
        <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
        <MessageSquare className="w-6 h-6 text-white relative z-10" />
        <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-black shadow-sm">
            AI
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#1e1e2e] rounded-xl border border-white/10 shadow-2xl flex flex-col h-[600px] overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-900/40 to-purple-900/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">Gemini Code Assistant</h3>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/> 
                        Online
                    </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0A0814]/50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : 'bg-[#2a2a35] text-gray-200 rounded-tl-sm border border-white/5'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                  <div className="flex justify-start">
                      <div className="bg-[#2a2a35] px-4 py-3 rounded-2xl rounded-tl-sm border border-white/5 flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                      </div>
                  </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-[#151520]">
                <div className="flex items-center gap-2 mb-3 overflow-x-auto text-[10px] text-gray-400 pb-1 scrollbar-hide">
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 whitespace-nowrap">
                        <Terminal size={10} /> Environment: Development
                    </span>
                    <span className="flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20 whitespace-nowrap">
                        <GitBranch size={10} /> Branch: main
                    </span>
                </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask Gemini to change code or push to git..."
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-black/50 transition-all placeholder:text-gray-500"
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl text-white transition-all shadow-lg shadow-blue-900/20"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
