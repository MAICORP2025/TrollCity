import React, { useState, useEffect } from 'react';
import { X, Video, VideoOff, Mic, MicOff } from 'lucide-react';

interface BroadcasterStatsModalProps {
  stream: any;
  onClose: () => void;
  broadcasterProfile: any;
  isCameraOn?: boolean;
  isMicOn?: boolean;
  onToggleCamera?: () => void;
  onToggleMic?: () => void;
}

export default function BroadcasterStatsModal({
  stream,
  onClose,
  broadcasterProfile: _broadcasterProfile,
  isCameraOn: initialCameraOn = true,
  isMicOn: initialMicOn = true,
  onToggleCamera,
  onToggleMic
}: BroadcasterStatsModalProps) {
  const [isCameraOn, setIsCameraOn] = useState(initialCameraOn);
  const [isMicOn, setIsMicOn] = useState(initialMicOn);

  // Update state when props change
  useEffect(() => {
    setIsCameraOn(initialCameraOn);
  }, [initialCameraOn]);

  useEffect(() => {
    setIsMicOn(initialMicOn);
  }, [initialMicOn]);

  console.log('BroadcasterStatsModal state:', { isCameraOn, isMicOn });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Broadcaster Stats</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        {/* Camera and Mic Controls */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={async () => {
              console.log('Toggle camera clicked');
              try {
                await onToggleCamera?.();
                // Optimistically update UI
                setIsCameraOn(!isCameraOn);
              } catch (error) {
                console.error('Failed to toggle camera:', error);
              }
            }}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
              isCameraOn
                ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30'
                : 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
            }`}
          >
            {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
            <span className="text-sm font-medium">
              {isCameraOn ? 'Turn Off' : 'Turn On'}
            </span>
          </button>

          <button
            onClick={async () => {
              console.log('Toggle mic clicked');
              try {
                await onToggleMic?.();
                // Optimistically update UI
                setIsMicOn(!isMicOn);
              } catch (error) {
                console.error('Failed to toggle mic:', error);
              }
            }}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
              isMicOn
                ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30'
                : 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30'
            }`}
          >
            {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
            <span className="text-sm font-medium">
              {isMicOn ? 'Turn Off' : 'Turn On'}
            </span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Stream Status</span>
            <span className="text-green-400 font-medium">Live</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Viewer Count</span>
            <span className="text-white font-medium">{stream?.current_viewers || stream?.viewer_count || 0}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Stream Duration</span>
            <span className="text-white font-medium">--:--:--</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Likes</span>
            <span className="text-white font-medium">{stream?.like_count || 0}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Coins Earned</span>
            <span className="text-yellow-400 font-medium">{stream?.coin_earnings || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
