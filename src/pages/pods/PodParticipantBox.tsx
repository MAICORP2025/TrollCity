import React, { useEffect, useState } from 'react';
import { Participant, Track, LocalParticipant, RemoteParticipant, TrackPublication } from 'livekit-client';
import { Mic, MicOff, User, MoreVertical, Ban, UserMinus, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PodParticipantBoxProps {
  participant: Participant;
  isHost: boolean; // Is the viewer the host of the room?
  isSelf: boolean; // Is this box for the viewer themselves?
  onKick?: (identity: string) => void;
  onMute?: (identity: string) => void;
  onDemote?: (identity: string) => void;
}

export default function PodParticipantBox({
  participant,
  isHost,
  isSelf,
  onKick,
  onMute,
  onDemote
}: PodParticipantBoxProps) {
  const [videoTrack, setVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const isLocal = participant instanceof LocalParticipant;

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
      if (track.kind === Track.Kind.Audio) setAudioTrack(track.mediaStreamTrack);
    };

    const handleTrackUnsubscribed = (track: Track, pub: TrackPublication) => {
      if (track.kind === Track.Kind.Video) setVideoTrack(null);
      if (track.kind === Track.Kind.Audio) setAudioTrack(null);
    };
    
    const handleMute = (pub: TrackPublication) => {
        if (pub.kind === Track.Kind.Microphone) setIsMuted(true);
    }
    const handleUnmute = (pub: TrackPublication) => {
        if (pub.kind === Track.Kind.Microphone) setIsMuted(false);
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
    <div className="relative group w-full aspect-video rgb-frame rounded-xl">
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

      {/* Overlay Info */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-2 bg-black/60 px-2 py-1 rounded-full backdrop-blur-sm">
        <span className="text-white text-sm font-bold truncate max-w-[100px]">
          {userProfile?.username || participant.identity}
        </span>
        {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4 text-green-500" />}
      </div>

      {/* Host Controls */}
      {isHost && !isSelf && (
        <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => onDemote?.(participant.identity)}
              className="p-2 bg-yellow-600/80 hover:bg-yellow-700 rounded-full text-white"
              title="Remove from Stage"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onMute?.(participant.identity)}
              className="p-2 bg-red-500/80 hover:bg-red-600 rounded-full text-white"
              title="Mute User"
            >
              <MicOff className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onKick?.(participant.identity)}
              className="p-2 bg-red-700/80 hover:bg-red-800 rounded-full text-white"
              title="Kick User"
            >
              <UserMinus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
