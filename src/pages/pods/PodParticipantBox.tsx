import React, { useEffect, useState } from 'react';
import { Participant, Track, LocalParticipant, TrackPublication } from 'livekit-client';
import { Mic, MicOff, Crown, Shield, User, MoreVertical, ArrowDown, MessageSquareOff, UserMinus, Ban } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import GiftModal from '@/components/GiftModal';

interface PodParticipantBoxProps {
  participant: Participant;
  isHost: boolean; // Is the viewer the host of the room?
  isOfficer?: boolean; // Is the viewer an officer?
  isSelf: boolean; // Is this box for the viewer themselves?
  onKick?: (identity: string) => void;
  onBan?: (identity: string) => void; // Permanent/Long ban
  onMute?: (identity: string) => void;
  onDemote?: (identity: string) => void;
  onPromoteOfficer?: (identity: string) => void;
  onDisableChat?: (identity: string) => void;
}

export default function PodParticipantBox({
  participant,
  isHost,
  isOfficer,
  isSelf,
  onKick,
  onBan,
  onMute,
  onDemote,
  onPromoteOfficer,
  onDisableChat
}: PodParticipantBoxProps) {
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  
  const isLocal = participant instanceof LocalParticipant;
  const canManage = (isHost || isOfficer) && !isSelf;
  
  // Identity is usually the user_id
  const userId = participant.identity;
  const [userProfile, setUserProfile] = useState<{ username: string; avatar_url: string } | null>(null);

  useEffect(() => {
    // Fetch profile
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single();
      if (data) setUserProfile(data);
    };
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    const getTrack = (source: Track.Source) => {
        const pub = participant.getTrackPublication(source);
        return pub?.track?.mediaStreamTrack || null;
    };

    setVideoTrack(getTrack(Track.Source.Camera));
    setAudioTrack(getTrack(Track.Source.Microphone));

    const handleTrackSubscribed = (track: Track, pub: TrackPublication) => {
      if (track.kind === Track.Kind.Video) setVideoTrack(track.mediaStreamTrack);
      if (track.kind === Track.Kind.Audio) {
        setAudioTrack(track.mediaStreamTrack);
        // Update mute status when track arrives
        if (pub.source === Track.Source.Microphone) {
            setIsMuted(pub.isMuted);
        }
      }
    };

    const handleTrackUnsubscribed = (track: Track, pub: TrackPublication) => {
      if (track.kind === Track.Kind.Video) setVideoTrack(null);
      if (track.kind === Track.Kind.Audio) {
        setAudioTrack(null);
        // If mic is removed, mark as muted
        if (pub.source === Track.Source.Microphone) {
            setIsMuted(true);
        }
      }
    };
    
    const handleMute = (pub: TrackPublication) => {
        if (pub.source === Track.Source.Microphone) setIsMuted(true);
    }
    const handleUnmute = (pub: TrackPublication) => {
        if (pub.source === Track.Source.Microphone) setIsMuted(false);
    }

    participant.on('trackSubscribed', handleTrackSubscribed);
    participant.on('trackUnsubscribed', handleTrackUnsubscribed);
    participant.on('trackMuted', handleMute);
    participant.on('trackUnmuted', handleUnmute);

    // Initial state
    setIsMuted(participant.isMicrophoneEnabled === false);

    return () => {
      participant.off('trackSubscribed', handleTrackSubscribed);
      participant.off('trackUnsubscribed', handleTrackUnsubscribed);
      participant.off('trackMuted', handleMute);
      participant.off('trackUnmuted', handleUnmute);
    };
  }, [participant]);

  // Attach video to element
  const videoRef = React.useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && videoTrack) {
      videoRef.current.srcObject = new MediaStream([videoTrack]);
      videoRef.current.play().catch(e => console.error("Video play error", e));
    }
  }, [videoTrack]);

  // Attach audio (if not local)
  const audioRef = React.useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (isLocal) return; // Don't play own audio
    if (audioRef.current && audioTrack) {
      audioRef.current.srcObject = new MediaStream([audioTrack]);
      audioRef.current.play().catch(e => console.error("Audio play error", e));
    }
  }, [audioTrack, isLocal]);

  // RGB Border Style - using global CSS .rgb-frame
  
  return (
    <>
      <div 
        className={`relative group w-full aspect-video rgb-frame rounded-xl ${!isSelf ? 'cursor-pointer' : ''}`}
        onClick={() => {
            if (!isSelf) setShowGiftModal(true);
        }}
      >
      <div className="w-full h-full bg-black relative overflow-hidden rounded-lg">
      
      {/* Video or Avatar */}
      {videoTrack ? (
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover" 
          muted={true} // Always mute video element, audio handled separately
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          {userProfile?.avatar_url ? (
            <img src={userProfile.avatar_url} alt={userProfile.username} className="w-24 h-24 rounded-full border-2 border-white/20" />
          ) : (
            <User className="w-20 h-20 text-gray-500" />
          )}
        </div>
      )}

      {/* Audio Element */}
      {!isLocal && <audio ref={audioRef} />}

      {/* Host / Officer Badge */}
      {(isHost || isOfficer) && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1">
            {isHost && (
                <div className="flex items-center gap-1 bg-yellow-500/90 text-black px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider shadow-lg shadow-yellow-500/20">
                    <Crown className="w-3 h-3 fill-black" />
                    HOST
                </div>
            )}
            {isOfficer && !isHost && (
                <div className="flex items-center gap-1 bg-blue-500/90 text-white px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-500/20">
                    <Shield className="w-3 h-3 fill-white" />
                    OFFICER
                </div>
            )}
        </div>
      )}

      {/* Overlay Info */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm">
        <span className="text-white text-sm font-bold truncate max-w-[100px]">
          {userProfile?.username || participant.identity}
        </span>
        {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4 text-green-500" />}
      </div>

      {/* Host/Officer Controls */}
      {canManage && (
        <div className="absolute top-2 right-2 z-30">
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 bg-black/60 hover:bg-gray-800 rounded-full text-white backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            data-state={showMenu ? 'open' : 'closed'}
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-50 flex flex-col">
                <button 
                    onClick={() => { onMute?.(participant.identity); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                >
                    <MicOff className="w-4 h-4 text-yellow-500" />
                    Mute Mic
                </button>
                
                <button 
                    onClick={() => { onDemote?.(participant.identity); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                >
                    <ArrowDown className="w-4 h-4 text-orange-400" />
                    Remove from Stage
                </button>

                {isHost && (
                    <button 
                        onClick={() => { onPromoteOfficer?.(participant.identity); setShowMenu(false); }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                    >
                        <Shield className="w-4 h-4 text-blue-400" />
                        Make Officer
                    </button>
                )}

                <button 
                    onClick={() => { onDisableChat?.(participant.identity); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white text-left transition-colors"
                >
                    <MessageSquareOff className="w-4 h-4 text-purple-400" />
                    Disable Chat
                </button>

                <div className="h-px bg-gray-700 my-1" />

                <button 
                    onClick={() => { onKick?.(participant.identity); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 text-left transition-colors"
                >
                    <UserMinus className="w-4 h-4" />
                    Kick User
                </button>
                
                <button 
                    onClick={() => { onBan?.(participant.identity); setShowMenu(false); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-900/30 hover:text-red-400 text-left transition-colors font-bold"
                >
                    <Ban className="w-4 h-4" />
                    Kick & Ban (24h)
                </button>
            </div>
          )}
          
          {/* Click outside listener could be added here or just rely on mouseleave/toggle */}
          {showMenu && (
             <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          )}
        </div>
      )}
      </div>
    </div>
    
    <GiftModal 
        isOpen={showGiftModal} 
        onClose={() => setShowGiftModal(false)} 
        recipientId={userId}
        recipientUsername={userProfile?.username || participant.identity}
    />
    </>
  );
}
