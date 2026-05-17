/**
 * CourtViewerPage - Public Court Session Viewer
 *
 * Allows all users to watch live Troll Court sessions via Mux HLS.
 * Similar to TCNNViewerPage but for court sessions.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import {
  Scale,
  Eye,
  Heart,
  MessageSquare,
  X,
  Send,
  User,
  ArrowLeft,
  ThumbsUp,
  Sparkles,
  Volume2,
  Maximize,
} from 'lucide-react';
import { generateUUID } from '@/lib/uuid';

interface CourtSession {
  id: string;
  title?: string;
  is_live?: boolean;
  viewer_count?: number;
  total_likes?: number;
  hls_url?: string;
}

interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string;
  content: string;
  created_at: string;
  type: 'chat' | 'system';
}

export default function CourtViewerPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();

  // Court session state
  const [courtSession, setCourtSession] = useState<CourtSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);

  // Mux HLS playback
  const videoRef = useRef<HTMLVideoElement>(null);

  // Chat
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // UI state
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Like tracking
  const clickHistoryRef = useRef<number[]>([]);
  const [isClickBlocked, setIsClickBlocked] = useState(false);

  // Fetch court session
  useEffect(() => {
    if (!sessionId) {
      navigate('/troll-court');
      return;
    }

    const fetchCourtSession = async () => {
      // First try to get the court session
      const { data: sessionData, error: sessionError } = await supabase
        .from('court_sessions')
        .select('id, status, created_at')
        .eq('id', sessionId)
        .maybeSingle();

      if (sessionError || !sessionData) {
        console.error('Court session not found:', sessionError);
        navigate('/troll-court');
        return;
      }

      if (!['active', 'live'].includes(sessionData.status)) {
        toast.info('This court session is not currently live');
        navigate('/troll-court');
        return;
      }

      // Try to get the associated stream
      const { data: streamData, error: streamError } = await supabase
        .from('streams')
        .select(`
          id, title, user_id, is_live, viewer_count, total_likes, hls_url
        `)
        .eq('id', `court-${sessionId}`)
        .maybeSingle();

      if (streamError || !streamData) {
        console.warn('Court stream not found, court may not be public yet');
        setCourtSession({
          id: sessionData.id,
          title: `Troll Court Session - ${new Date(sessionData.created_at).toLocaleDateString()}`,
          is_live: true,
          viewer_count: 0,
          total_likes: 0,
        });
      } else {
        setCourtSession({
          ...streamData,
          title: streamData.title || `Troll Court Session - ${new Date(sessionData.created_at).toLocaleDateString()}`,
        });
        setViewerCount(streamData.current_viewers || streamData.viewer_count || 0);
        setTotalLikes(streamData.total_likes || 0);
      }

      setIsLoading(false);
    };

    fetchCourtSession();
    const interval = setInterval(fetchCourtSession, 15000);
    return () => clearInterval(interval);
  }, [sessionId, navigate]);

  // Mux HLS playback for viewers
  useEffect(() => {
    if (!courtSession?.hls_url || !videoRef.current) return;

    console.log('[CourtViewer] Setting up Mux HLS playback:', courtSession.hls_url);
    videoRef.current.src = courtSession.hls_url;
    videoRef.current.load();

    return () => {
      if (videoRef.current) {
        videoRef.current.src = '';
      }
    };
  }, [courtSession?.hls_url]);

  // Realtime channel for chat, likes, presence
  useEffect(() => {
    if (!sessionId || !user) return;

    const channel = supabase.channel(`court_session_chat_${sessionId}`);
    channel
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'court_events',
        filter: `court_session_id=eq.${sessionId}`
      }, (payload) => {
        if (payload.new) {
          const event = payload.new as any;
          if (event.event_type === 'chat_message') {
            const message: ChatMessage = {
              id: event.id,
              user_id: event.user_id || 'system',
              username: event.metadata?.username || 'Anonymous',
              avatar_url: event.metadata?.avatar_url,
              content: event.metadata?.message || event.content || '',
              created_at: event.created_at,
              type: 'chat'
            };
            setMessages(prev => [...prev.slice(-49), message]);
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId, user]);

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || !user || !profile) return;

    try {
      const { error } = await supabase
        .from('court_events')
        .insert({
          court_session_id: sessionId,
          user_id: user.id,
          event_type: 'chat_message',
          content: chatInput,
          metadata: {
            username: profile.username,
            avatar_url: profile.avatar_url,
            message: chatInput
          }
        });

      if (error) throw error;
      setChatInput('');
    } catch (err) {
      console.error('[CourtViewer] Chat error:', err);
    }
  }, [chatInput, user, profile, sessionId]);

  const handleLike = useCallback(async () => {
    if (!user || isClickBlocked) return;

    // Rate limiting
    const now = Date.now();
    clickHistoryRef.current = clickHistoryRef.current.filter(time => now - time < 10000);
    if (clickHistoryRef.current.length >= 5) {
      setIsClickBlocked(true);
      setTimeout(() => setIsClickBlocked(false), 10000);
      return;
    }
    clickHistoryRef.current.push(now);

    try {
      // Send like event
      await supabase
        .from('court_events')
        .insert({
          court_session_id: sessionId,
          user_id: user.id,
          event_type: 'like',
          metadata: {
            username: profile?.username,
            avatar_url: profile?.avatar_url
          }
        });

      setTotalLikes(prev => prev + 1);
    } catch (err) {
      console.error('[CourtViewer] Like error:', err);
    }
  }, [user, profile, sessionId, isClickBlocked]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-white/50">Loading Court Session...</p>
        </div>
      </div>
    );
  }

  if (!courtSession) return null;

  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-white overflow-hidden relative">
      {/* ============ FULL SCREEN VIDEO (Mux HLS) ============ */}
      <div className="absolute inset-0 z-0">
        {courtSession.hls_url ? (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            onError={() => {
              console.error('[CourtViewer] Video playback error');
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <Scale className="w-12 h-12 text-purple-500 mx-auto mb-2" />
              <p className="text-gray-400">Court session is live but stream is not yet available</p>
              <p className="text-gray-500 text-sm mt-2">Please wait while we connect...</p>
            </div>
          </div>
        )}
      </div>

      {/* Overlay Controls */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 pointer-events-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/troll-court')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-purple-400" />
                <span className="font-bold text-purple-400">TROLL COURT</span>
                <div className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded animate-pulse">
                  LIVE
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Eye className="w-4 h-4" />
                <span>{viewerCount}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Heart className="w-4 h-4" />
                <span>{totalLikes}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Court Info Overlay */}
        <div className="absolute top-20 left-4 right-4 pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-4 max-w-md">
            <h2 className="text-lg font-bold text-purple-300 mb-2">⚖ Court in Session</h2>
            <p className="text-sm text-gray-300">
              {courtSession.title}
            </p>
            <div className="mt-2 text-xs text-gray-400">
              All court proceedings are recorded for transparency
            </div>
          </div>
        </div>

        {/* Like Button */}
        <div className="absolute bottom-24 right-4 pointer-events-auto">
          <button
            onClick={handleLike}
            disabled={isClickBlocked}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded-full font-bold transition-all transform hover:scale-105"
          >
            <Heart className="w-5 h-5" />
            <span className="text-sm">{totalLikes}</span>
          </button>
        </div>

        {/* Chat Panel */}
        {chatOpen && (
          <div className="absolute bottom-4 right-4 w-80 h-64 bg-black/80 backdrop-blur-sm rounded-lg pointer-events-auto">
            <div className="flex items-center justify-between p-3 border-b border-gray-700">
              <h3 className="font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Court Chat
              </h3>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-32">
              {messages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <span className="font-bold text-purple-300">{msg.username}:</span> {msg.content}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-gray-700">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Comment on the case..."
                  className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                />
                <button
                  onClick={handleSendChat}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded font-bold transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Toggle */}
        {!chatOpen && (
          <div className="absolute bottom-4 right-4 pointer-events-auto">
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-full font-bold transition-all transform hover:scale-105"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm">Chat</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}