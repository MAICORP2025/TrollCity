import React, { useState, useEffect, useRef } from 'react'
import { Participant, Track, LocalParticipant } from 'livekit-client'
import { User, Mic, MicOff, Camera, CameraOff, X, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface VideoTileProps {
  participant: Participant
  isBroadcaster?: boolean
  className?: string
  onLeave?: () => void
  isLocal?: boolean
}

export default function VideoTile({ participant, isBroadcaster, className, onLeave, isLocal }: VideoTileProps) {
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
          // setMicrophoneEnabled returns Promise<void> in recent versions, or Promise<boolean> in others.
          // We can check isAudioEnabled state or check track publication
          const pub = participant.getTrackPublication(Track.Source.Microphone);
          setIsAudioEnabled(pub ? !pub.isMuted : false);
      }
  };

  const switchCamera = async (e: React.MouseEvent) => {
      e.stopPropagation();
      // @ts-ignore - internal method but widely used
      if (participant instanceof LocalParticipant) {
         try {
             const devices = await navigator.mediaDevices.enumerateDevices();
             const videoDevices = devices.filter(d => d.kind === 'videoinput');
             if (videoDevices.length > 1) {
                 const currentTrack = participant.getTrackPublication(Track.Source.Camera)?.videoTrack;
                 const currentDeviceId = currentTrack?.mediaStreamTrack.getSettings().deviceId;
                 const nextDevice = videoDevices.find(d => d.deviceId !== currentDeviceId);
                 if (nextDevice) {
                     // Check if switchCamera exists on videoTrack (it might not on LocalTrack)
                     // or create new track and publish
                     // For now, simpler approach if supported:
                     // @ts-ignore
                     if (participant.switchCamera) {
                        // @ts-ignore
                        await participant.switchCamera(nextDevice.deviceId);
                     } else {
                        // Restart track with new device
                        await participant.setCameraEnabled(false);
                        await participant.setCameraEnabled(true, { deviceId: nextDevice.deviceId });
                     }
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
}
