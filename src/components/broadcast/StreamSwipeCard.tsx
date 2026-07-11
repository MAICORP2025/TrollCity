/**
 * StreamSwipeCard - Full-screen stream card for TikTok-style swipe interface
 * Displays stream video/grid with overlay info
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { Stream } from '../../types/broadcast';
import { toast } from 'sonner';
import { Eye, Heart, MessageCircle, Gift, Share2, Users, UserPlus, Coins } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Room, RoomEvent, RemoteParticipant, RemoteVideoTrack, RemoteAudioTrack } from 'livekit-client';
import ShareModal from './ShareModal';

interface StreamSwipeCardProps {
  stream: Stream & {
    broadcaster?: {
      username: string;
      avatar_url: string | null;
      level?: number;
    };
  };
  isActive: boolean;
  isMuted: boolean;
  onClose: () => void;
  broadcasterCoins?: number;
}

// Extended stream type with broadcaster info
type StreamWithProfile = Stream & {
  broadcaster?: {
    username: string;
    avatar_url: string | null;
    level?: number;
  };
};

export default function StreamSwipeCard({ stream, isActive, isMuted, onClose, broadcasterCoins }: StreamSwipeCardProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [viewerCount, setViewerCount] = useState(stream.current_viewers || stream.viewer_count || 0);
  const [likeCount, setLikeCount] = useState(stream.total_likes || 0);
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinPrompt, setShowJoinPrompt] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  
  const roomRef = useRef<Room | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  const clickTimesRef = useRef<number[]>([]);
  const blockedUntilRef = useRef<number | null>(null);
  const pendingLikesRef = useRef(0);
  const flushInProgressRef = useRef(false);
  
  // Convert stream ID to numeric UID for Agora
  const stringToUid = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };
  
  // Join Agora channel when card becomes active
  const joinStream = useCallback(async () => {
    if (!isActive || hasJoinedRef.current || !user) return;
    
    hasJoinedRef.current = true;
    setIsJoining(true);
    
    try {
      const appId = import.meta.env.VITE_AGORA_APP_ID;
      if (!appId) {
        console.warn('VITE_AGORA_APP_ID not configured');
        setIsJoining(false);
        return;
      }
      
      // Get viewer token
      const numericUid = stringToUid(user.id);
      const { data: tokenData, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
          channel: stream.id,
          uid: numericUid,
          role: 'subscriber'
        }
      });
      
      if (tokenError || !tokenData?.token) {
        console.error('Token error:', tokenError);
        setIsJoining(false);
        return;
      }
      
      // Create Agora client
      const room = new Room({
        mode: 'rtc',
        codec: 'vp8'
      });
      
      roomRef.current = room;
      
      // Handle user published
      room.on(RoomEvent.ParticipantConnected, (participant) => {
        setRemoteUsers(prev => [...prev, participant]);
      });
      
      // Handle user unpublished
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        setRemoteUsers(prev => prev.filter(u => u.identity !== participant.identity));
      });
      
      // Join channel
      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      await room.connect(livekitUrl, tokenData.token, {
        autoSubscribe: true,
      });
      
      // Handle mute state
      if (isMuted) {
        // Audio handled by LiveKit;
      }
      
      console.log('[StreamSwipeCard] Joined stream:', stream.id);
      
    } catch (error) {
      console.error('Error joining stream:', error);
      hasJoinedRef.current = false;
    } finally {
      setIsJoining(false);
    }
  }, [stream.id]);
  
  // Leave stream when card becomes inactive
  const leaveStream = useCallback(async () => {
    if (!isActive && hasJoinedRef.current && roomRef.current) {
      try {
        await roomRef.current?.disconnect();
        roomRef.current = null;
        hasJoinedRef.current = false;
        setRemoteUsers([]);
        console.log('[StreamSwipeCard] Left stream:', stream.id);
      } catch (error) {
        console.error('Error leaving stream:', error);
      }
    }
  }, [isActive, stream.id]);
  
  // Handle mute state changes
  useEffect(() => {
    if (roomRef.current) {
      if (isMuted) {
        roomRef.current.setAudioVolume(0);
      } else {
        roomRef.current.setAudioVolume(100);
      }
    }
  }, [isMuted]);
  
  // Join/leave based on active state
  useEffect(() => {
    if (isActive) {
      joinStream();
    } else {
      leaveStream();
    }
    
    return () => {
      if (roomRef.current) {
        roomRef.current?.disconnect();
        roomRef.current = null;
        hasJoinedRef.current = false;
      }
    };
  }, [isActive]);
  
   // Handle like
   const handleLike = async () => {
     if (!user) {
       navigate('/auth?mode=signup');
       return;
     }

     const now = Date.now();
     if (blockedUntilRef.current && now < blockedUntilRef.current) {
       const secondsLeft = Math.ceil((blockedUntilRef.current - now) / 1000);
       toast.error(`You're temporarily blocked from liking (${secondsLeft}s)`);
       return;
     }

     const times = clickTimesRef.current;
     times.push(now);
     const cutoff = now - 1000;
     while (times.length && times[0] < cutoff) times.shift();

     const tapsPerSec = times.length;
     if (tapsPerSec >= 20) {
       blockedUntilRef.current = now + 60 * 1000;
       clickTimesRef.current = [];
       toast.error('Rate limited for 1 minute due to suspected auto-clicking');
       return;
     }

     setLikeCount((prev) => Number(prev || 0) + 2);

     pendingLikesRef.current += 1;
     if (pendingLikesRef.current >= 25) {
       flushLikes();
     }
   };
  
   // Handle gift
   const handleGift = () => {
     if (!user) {
       navigate('/auth?mode=signup');
       return;
     }
     // Navigate to full stream view for gifting
     navigate(`/watch/${stream.id}?from=swipe`);
   };
   
   const flushLikes = useCallback(async () => {
     if (flushInProgressRef.current) return;
     const batch = pendingLikesRef.current;
     if (batch <= 0 || !stream?.id) return;

     pendingLikesRef.current = 0;
     flushInProgressRef.current = true;

     try {
       const { data, error } = await supabase.rpc('increment_stream_likes', {
         p_stream_id: stream.id,
         p_like_count: batch,
       });

       if (error) throw error;

       if (typeof data === 'number') {
         setLikeCount(data);
       }
     } catch (error) {
       pendingLikesRef.current += batch;
       console.error('Failed to flush likes:', error);
     } finally {
       flushInProgressRef.current = false;
     }
   }, [stream?.id]);

   useEffect(() => {
     const interval = window.setInterval(() => {
       flushLikes();
     }, 2500);

     const handleVisibilityChange = () => {
       if (document.visibilityState === 'hidden') {
         void flushLikes();
       }
     };

     document.addEventListener('visibilitychange', handleVisibilityChange);

     return () => {
       window.clearInterval(interval);
       document.removeEventListener('visibilitychange', handleVisibilityChange);
       void flushLikes();
     };
   }, [flushLikes]);
   
   // Handle tap to view full stream
  const handleTap = () => {
    const isGaming = stream.agora_channel || stream.category === 'gaming';
    navigate(isGaming ? `/gaming/watch/${stream.id}?from=swipe` : `/watch/${stream.id}?from=swipe`);
  };
  
  const broadcaster = stream.broadcaster;
  const isHost = user?.id === stream.user_id;
  
  return (
    <div className="w-full h-full relative bg-black overflow-hidden" style={{ touchAction: 'none' }}>
      {/* Video/Stream Container */}
      <div 
        ref={videoContainerRef}
        className="absolute inset-0"
        onClick={(e) => { e.stopPropagation(); handleLike(); }}
      >
        {remoteUsers.length > 0 ? (
          <div className={cn(
            "w-full h-full",
            remoteUsers.length === 1 ? "grid grid-cols-1" :
            remoteUsers.length === 2 ? "grid grid-cols-2" :
            "grid grid-cols-2 gap-0.5"
          )}>
            {remoteUsers.map((remoteUser) => (
              <div key={remoteUser.identity} className="relative bg-black">
                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                    <Users className="w-8 h-8 text-zinc-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Placeholder when no video */
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-pink-900 to-cyan-900">
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4">
              {broadcaster?.avatar_url ? (
                <img 
                  src={broadcaster.avatar_url} 
                  alt={broadcaster.username}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <Users className="w-12 h-12 text-white/30" />
              )}
            </div>
            <p className="text-white/60 text-sm">Waiting for broadcast...</p>
          </div>
        )}
      </div>
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-black/20 to-black/30" />
      
      {/* Stream info overlay - Bottom left */}
      <div className="absolute bottom-16 left-3 right-16 z-10 sm:bottom-20 sm:left-4 sm:right-20">
        {/* Broadcaster info */}
        <div className="flex items-center gap-2.5 mb-2 sm:gap-3 sm:mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-0.5 sm:w-12 sm:h-12">
            <div className="w-full h-full rounded-full bg-black overflow-hidden">
              {broadcaster?.avatar_url ? (
                <img 
                  src={broadcaster.avatar_url} 
                  alt={broadcaster.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                  <Users className="w-6 h-6 text-zinc-500" />
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base sm:text-lg">
                {broadcaster?.username || 'Broadcaster'}
              </span>
              {broadcaster?.level && (
                <span className="text-[10px] bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-300 px-1.5 py-0.5 rounded-full sm:text-xs sm:px-2 border border-violet-500/20">
                  T League
                </span>
              )}
            </div>
<span className="text-white/60 text-xs capitalize sm:text-sm">{stream.category}</span>
            {broadcasterCoins !== undefined && broadcasterCoins > 0 && (
              <div className="flex items-center gap-1 text-amber-400 text-xs sm:text-sm">
                <Coins className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-bold">{broadcasterCoins.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Title */}
        <h3 className="text-white font-medium text-base line-clamp-2 mb-1 sm:text-lg sm:mb-2">
          {stream.title || 'Untitled Stream'}
        </h3>
      </div>
      
      {/* Action buttons - Bottom right */}
      <div className="absolute bottom-16 right-3 z-10 flex flex-col items-center gap-3 sm:bottom-20 sm:right-4 sm:gap-4">
        {/* Like button removed - use tap on video to like */}
        
        {/* Comment button */}
        <button
          onClick={(e) => { e.stopPropagation(); const g = stream.agora_channel || stream.category === 'gaming'; navigate(g ? `/gaming/watch/${stream.id}?from=swipe` : `/watch/${stream.id}?from=swipe`); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors sm:w-12 sm:h-12">
            <MessageCircle className="w-5 h-5 text-white sm:w-6 sm:h-6" />
          </div>
        </button>
        
        {/* Gift button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleGift(); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors sm:w-12 sm:h-12">
            <Gift className="w-5 h-5 text-pink-400 sm:w-6 sm:h-6" />
          </div>
        </button>
        
        {/* Share button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors sm:w-12 sm:h-12">
            <Share2 className="w-5 h-5 text-white sm:w-6 sm:h-6" />
          </div>
        </button>
        
        {/* Join as guest button */}
        {!isHost && user && (
          <button
            onClick={(e) => { e.stopPropagation(); handleJoinSeat(); }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-11 h-11 rounded-full bg-purple-500/80 backdrop-blur-md flex items-center justify-center border border-purple-400/30 hover:bg-purple-500 transition-colors sm:w-12 sm:h-12">
              <UserPlus className="w-5 h-5 text-white sm:w-6 sm:h-6" />
            </div>
            <span className="text-xs text-white/80">Join</span>
          </button>
        )}
      </div>
      
      {/* Live and viewer badges */}
      <div className="absolute top-20 left-3 z-10 flex items-center gap-2 sm:left-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-white font-bold text-xs uppercase">Live</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur-md">
          <Eye className="w-3.5 h-3.5 text-white/80" />
          <span className="text-xs font-medium text-white">{viewerCount.toLocaleString()}</span>
        </div>
      </div>
      
      {/* Loading indicator */}
      {isJoining && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm">Joining stream...</span>
          </div>
        </div>
      )}

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        streamTitle={stream.title}
        streamUrl={`${window.location.origin}/watch/${stream.id}`}
        broadcasterName={broadcaster?.username}
      />
    </div>
  );
}
