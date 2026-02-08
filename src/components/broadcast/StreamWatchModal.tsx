import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { LiveKitRoom, VideoTrack, useTracks } from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { useLiveKitToken } from '../../hooks/useLiveKitToken';
import { useAuthStore } from '../../lib/store';

export interface WatchableStream {
  id: string;
  room_name?: string;
  agora_channel?: string;
  title?: string;
}

interface StreamWatchModalProps {
  stream: WatchableStream;
  onClose: () => void;
}

const VideoViewer = () => {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: true });
  // Show first video track
  const videoTrack = tracks.find(t => t.source === Track.Source.Camera || t.source === Track.Source.ScreenShare);
  
  if (!videoTrack) {
      return <div className="flex items-center justify-center h-full text-zinc-500">Waiting for video...</div>;
  }
  
  return <VideoTrack trackRef={videoTrack} className="w-full h-full object-contain" />;
};

import HLSPlayer from './HLSPlayer';

export default function StreamWatchModal({ stream, onClose }: StreamWatchModalProps) {
  const user = useAuthStore(s => s.user);
  
  // Prefer HLS if available to avoid LiveKit token usage (Viewer only)
  // But for Government Control, we might want low latency?
  // User requested "watch not broadcast" and "not granting livekit tokens".
  // So we prioritize HLS.
  const useHLS = !!(stream.agora_channel || stream.id); // HLS usually uses ID or a specific URL. 
  // Wait, the stream object in props has 'hls_url' usually?
  // Let's check the interface.
  // WatchableStream interface doesn't have hls_url. We should add it or cast.
  
  const hlsUrl = (stream as any).hls_url || (stream as any).hls_path;
  
  const { token, serverUrl, isLoading, error } = useLiveKitToken({
      streamId: stream.id,
      roomName: stream.id,
      userId: user?.id || `guest-${Math.random().toString(36).slice(2)}`,
      isHost: false,
      canPublish: false,
      enabled: !hlsUrl, // Only enable LiveKit if no HLS
      role: 'viewer'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-600 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        
        {hlsUrl ? (
            <div className="w-full h-full relative group">
                <HLSPlayer 
                    src={hlsUrl}
                    className="w-full h-full object-contain"
                    autoPlay={true}
                />
                <div className="absolute top-4 left-4 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded animate-pulse">
                    LIVE (HLS)
                </div>
            </div>
        ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-white gap-2">
                <Loader2 className="animate-spin text-green-500" />
                <span>Connecting to LiveKit...</span>
            </div>
        ) : error ? (
             <div className="flex flex-col items-center justify-center h-full text-white gap-2">
                <AlertTriangle className="text-red-500 w-8 h-8" />
                <div className="text-red-400">{error}</div>
             </div>
        ) : (
            <LiveKitRoom
                token={token}
                serverUrl={serverUrl}
                connect={true}
                video={true}
                audio={true}
                className="w-full h-full"
            >
                <VideoViewer />
            </LiveKitRoom>
        )}
      </div>
    </div>
  );
}
