import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useRoomParticipants } from '../../hooks/useRoomParticipants'
import { Participant, Track, LocalParticipant, Room } from 'livekit-client'
import { User, Minus, Plus, Mic, MicOff, Camera, CameraOff, X, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface BroadcastLayoutProps {
  room: Room
  broadcasterId: string
  isHost: boolean
  totalCoins?: number
  joinPrice?: number
  onSetPrice?: (price: number) => void
  onJoinRequest?: () => void
  onLeaveSession?: () => void
  children?: React.ReactNode
}

interface VideoTileProps {
  participant: Participant
  isBroadcaster?: boolean
  className?: string
  onLeave?: () => void
  isLocal?: boolean
}

const VideoTile = ({ participant, isBroadcaster, className, onLeave, isLocal }: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Fetch profile for avatar
  useEffect(() => {
    const fetchProfile = async () => {
        if (!participant.identity) return;
        const { data } = await supabase.from('user_profiles').select('avatar_url').eq('id', participant.identity).single();
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    fetchProfile();
  }, [participant.identity]);

  useEffect(() => {
    const onSpeakingChanged = () => setSpeaking(participant.isSpeaking);
    const onTrackMuted = (pub: any) => {
        if (pub.kind === Track.Kind.Video) setIsVideoEnabled(false);
        if (pub.kind === Track.Kind.Audio) setIsAudioEnabled(false);
    };
    const onTrackUnmuted = (pub: any) => {
        if (pub.kind === Track.Kind.Video) setIsVideoEnabled(true);
        if (pub.kind === Track.Kind.Audio) setIsAudioEnabled(true);
    };
    const onTrackSubscribed = (track: Track) => {
        if (track.kind === Track.Kind.Video) {
            track.attach(videoRef.current!);
            setIsVideoEnabled(true);
        }
        if (track.kind === Track.Kind.Audio) {
            setIsAudioEnabled(true);
        }
    };
    const onTrackUnsubscribed = (track: Track) => {
         if (track.kind === Track.Kind.Video) setIsVideoEnabled(false);
    };

    participant.on('speakingChanged', onSpeakingChanged);
    participant.on('trackMuted', onTrackMuted);
    participant.on('trackUnmuted', onTrackUnmuted);
    participant.on('trackSubscribed', onTrackSubscribed);
    participant.on('trackUnsubscribed', onTrackUnsubscribed);
    
    // Initial state check
    setSpeaking(participant.isSpeaking);
    const vidPub = participant.getTrackPublication(Track.Source.Camera);
    if (vidPub && vidPub.isSubscribed && vidPub.videoTrack) {
        vidPub.videoTrack.attach(videoRef.current!);
        setIsVideoEnabled(!vidPub.isMuted);
    }
    const audPub = participant.getTrackPublication(Track.Source.Microphone);
    if (audPub) {
        setIsAudioEnabled(!audPub.isMuted);
    }

    return () => {
        participant.off('speakingChanged', onSpeakingChanged);
        participant.off('trackMuted', onTrackMuted);
        participant.off('trackUnmuted', onTrackUnmuted);
        participant.off('trackSubscribed', onTrackSubscribed);
        participant.off('trackUnsubscribed', onTrackUnsubscribed);
    };
  }, [participant]);

  const toggleCamera = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (participant instanceof LocalParticipant) {
          const enabled = await participant.setCameraEnabled(!isVideoEnabled);
          setIsVideoEnabled(enabled);
      }
  };

  const toggleMic = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (participant instanceof LocalParticipant) {
          const enabled = await participant.setMicrophoneEnabled(!isAudioEnabled);
          setIsAudioEnabled(enabled);
      }
  };

  const switchCamera = async (e: React.MouseEvent) => {
      e.stopPropagation();
      // @ts-ignore - internal method but widely used
      if (participant instanceof LocalParticipant && participant.videoTrackPublications) {
         // Simple toggle for mobile devices usually handled by asking for facing mode
         // But livekit-client doesn't have a simple 'flip' without enumerating devices.
         // For now, we rely on the browser's ability or advanced implementation.
         // Let's try to find another video input.
         try {
             const devices = await navigator.mediaDevices.enumerateDevices();
             const videoDevices = devices.filter(d => d.kind === 'videoinput');
             if (videoDevices.length > 1) {
                 const currentTrack = participant.getTrackPublication(Track.Source.Camera)?.videoTrack;
                 const currentDeviceId = currentTrack?.mediaStreamTrack.getSettings().deviceId;
                 const nextDevice = videoDevices.find(d => d.deviceId !== currentDeviceId);
                 if (nextDevice) {
                     await participant.switchCamera(nextDevice.deviceId);
                 }
             }
         } catch (err) {
             console.error("Failed to switch camera", err);
         }
      }
  };

  return (
    <div 
        className={`relative bg-black rounded-lg overflow-hidden transition-all duration-300 group ${className} ${speaking ? 'border-2 border-purple-500' : 'border border-white/10'}`}
        onClick={() => isLocal && setShowControls(!showControls)}
    >
      {/* Video Element */}
      <video ref={videoRef} className={`w-full h-full object-cover ${isVideoEnabled ? 'block' : 'hidden'}`} />
      
      {/* Fallback Profile Picture */}
      {!isVideoEnabled && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
              {avatarUrl ? (
                  <img src={avatarUrl} alt={participant.identity} className="w-20 h-20 rounded-full border-2 border-white/20" />
              ) : (
                  <User size={40} className="text-white/20" />
              )}
          </div>
      )}

      {/* Name Label */}
      <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white backdrop-blur-sm z-10">
        {isBroadcaster ? '👑 ' : ''}{participant.name || participant.identity || 'Guest'}
      </div>

      {/* Local Controls Overlay */}
      {isLocal && showControls && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-4 animate-fadeIn">
              <div className="flex items-center gap-4">
                  <button onClick={toggleMic} className={`p-3 rounded-full ${isAudioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600'}`}>
                      {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                  </button>
                  <button onClick={toggleCamera} className={`p-3 rounded-full ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600'}`}>
                      {isVideoEnabled ? <Camera size={24} /> : <CameraOff size={24} />}
                  </button>
                  <button onClick={switchCamera} className="p-3 rounded-full bg-white/10 hover:bg-white/20">
                      <RefreshCw size={24} />
                  </button>
              </div>
              {onLeave && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onLeave(); }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-sm flex items-center gap-2"
                  >
                      <X size={16} /> Leave Box
                  </button>
              )}
          </div>
      )}
    </div>
  );
};

export default function BroadcastLayout({ room, broadcasterId, isHost, totalCoins = 0, joinPrice = 0, onSetPrice, onJoinRequest, onLeaveSession, children }: BroadcastLayoutProps) {
  const participants = useRoomParticipants(room);
  const [guestSlotCount, setGuestSlotCount] = useState(5);

  const broadcaster = useMemo(() => {
    return participants.find(p => p.identity === broadcasterId);
  }, [participants, broadcasterId]);

  const guests = useMemo(() => {
    return participants.filter(p => p.identity !== broadcasterId);
  }, [participants, broadcasterId]);

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Main Broadcaster Area - Constrained to roughly 60% height or aspect ratio */}
      <div className="relative flex-none h-[60%] min-h-[300px] w-full flex justify-center">
        <div className="relative aspect-video h-full max-w-full bg-black rounded-2xl overflow-hidden border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
          {broadcaster ? (
            <VideoTile 
                participant={broadcaster} 
                isBroadcaster={true} 
                className="w-full h-full" 
                isLocal={isHost}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30">
              Waiting for broadcaster...
            </div>
          )}
          
          {/* Coin Counter Overlay */}
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-yellow-500/30 px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg z-10">
             <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-black font-bold text-xs">C</div>
             <span className="text-yellow-400 font-bold text-lg">{totalCoins.toLocaleString()}</span>
          </div>

          {/* Broadcaster Price Control */}
          {isHost && onSetPrice && (
            <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2 z-10">
              <span className="text-xs text-gray-300">Join Price:</span>
              <input 
                type="number" 
                value={joinPrice} 
                onChange={(e) => onSetPrice(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 bg-white/10 border border-white/20 rounded px-1 text-sm text-white"
              />
            </div>
          )}

          {/* Injected Overlays (e.g. Gifts) */}
          {children}
        </div>
      </div>

      {/* Guest Row */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-1 px-1 shrink-0">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">Guests</h3>
          {isHost && (
            <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
              <button 
                onClick={() => setGuestSlotCount(prev => Math.max(1, prev - 1))}
                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
              >
                <Minus size={14} />
              </button>
              <span className="text-xs font-mono w-4 text-center">{guestSlotCount}</span>
              <button 
                onClick={() => setGuestSlotCount(prev => Math.min(6, prev + 1))}
                className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          )}
        </div>
        
        {/* Scrollable Guest Row */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide h-full items-start">
          {Array.from({ length: guestSlotCount }).map((_, i) => (
            <div key={i} className="aspect-video h-[120px] md:h-[140px] shrink-0 bg-white/5 rounded-lg border border-white/5 overflow-hidden relative group">
              {guests[i] ? (
                <VideoTile 
                  participant={guests[i]} 
                  className="w-full h-full"
                  isLocal={guests[i].identity === room.localParticipant.identity}
                  onLeave={guests[i].identity === room.localParticipant.identity ? onLeaveSession : undefined}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/10 hover:bg-white/10 transition-colors">
                  {!isHost && onJoinRequest ? (
                    <button 
                      onClick={onJoinRequest}
                      className="flex flex-col items-center gap-1 group-hover:scale-110 transition-transform"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-lg">
                        <Plus size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-purple-300">
                        {joinPrice > 0 ? `${joinPrice} Coins` : 'Join'}
                      </span>
                    </button>
                  ) : (
                     <User size={20} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
