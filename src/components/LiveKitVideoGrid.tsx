import React, { useEffect, useRef } from 'react';
import { useLiveKit } from '../contexts/LiveKitContext';

interface VideoGridProps {
  className?: string;
  showLocalVideo?: boolean;
  maxParticipants?: number;
}

export function VideoGrid({
  className = '',
  showLocalVideo = true,
  maxParticipants = 6
}: VideoGridProps) {
  const { room, participants, localParticipant, isConnected } = useLiveKit();
  const gridRef = useRef<HTMLDivElement>(null);

  // If VideoGrid is visible but not connected, show error
  if (!isConnected) {
    return (
      <div className={`flex items-center justify-center bg-black border-2 border-red-500 ${className}`}>
        <div className="text-center text-red-400">
          <div className="text-2xl mb-2">📡</div>
          <div className="text-sm">Not connected to stream</div>
        </div>
      </div>
    );
  }

  // If VideoGrid is visible but no room, show error
  if (!room) {
    return (
      <div className={`flex items-center justify-center bg-black border-2 border-red-500 ${className}`}>
        <div className="text-center text-red-400">
          <div className="text-2xl mb-2">🏠</div>
          <div className="text-sm">No room available</div>
        </div>
      </div>
    );
  }

  // Get all participants including local
  const allParticipants = Array.from(participants.values());
  if (showLocalVideo && localParticipant) {
    allParticipants.unshift(localParticipant); // Add local participant first
  }

  // Limit participants
  const visibleParticipants = allParticipants.slice(0, maxParticipants);

  // Calculate grid layout
  const getGridLayout = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count <= 4) return 'grid-cols-2 grid-rows-2';
    if (count <= 6) return 'grid-cols-3 grid-rows-2';
    return 'grid-cols-3 grid-rows-2'; // Default for more than 6
  };

  return (
    <div
      ref={gridRef}
      className={`grid gap-2 bg-black p-2 ${getGridLayout(visibleParticipants.length)} ${className}`}
    >
      {visibleParticipants.map((participant) => (
        <VideoTile
          key={participant.identity}
          participant={participant}
          isLocal={participant.isLocal}
        />
      ))}

      {/* Fill empty slots if needed */}
      {visibleParticipants.length === 0 && (
        <div className="col-span-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📹</div>
            <div className="text-sm">Waiting for participants...</div>
          </div>
        </div>
      )}
    </div>
  );
}

interface VideoTileProps {
  participant: any;
  isLocal: boolean;
}

function VideoTile({ participant, isLocal }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!participant || !videoRef.current) return;

    // Attach video track to video element
    if (participant.videoTrack) {
      participant.videoTrack.attach(videoRef.current);
    }

    // Attach audio track
    if (participant.audioTrack) {
      participant.audioTrack.attach(videoRef.current);
    }

    return () => {
      // Detach tracks on cleanup
      if (participant.videoTrack) {
        participant.videoTrack.detach(videoRef.current);
      }
      if (participant.audioTrack) {
        participant.audioTrack.detach(videoRef.current);
      }
    };
  }, [participant]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Mute local video to prevent feedback
        className="w-full h-full object-cover"
      />

      {/* Participant info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium">
            {participant.name || participant.identity}
            {isLocal && ' (You)'}
          </span>
          <div className="flex items-center gap-1">
            {/* Camera status */}
            {participant.isCameraEnabled ? (
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            ) : (
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            )}
            {/* Mic status */}
            {participant.isMicrophoneEnabled ? (
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            ) : (
              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            )}
          </div>
        </div>
      </div>

      {/* Local participant indicator */}
      {isLocal && (
        <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
          LIVE
        </div>
      )}
    </div>
  );
}

// LiveKitRoom wrapper component that includes VideoGrid
interface LiveKitRoomWrapperProps {
  roomName: string;
  user: any;
  children?: React.ReactNode;
  className?: string;
  showLocalVideo?: boolean;
  maxParticipants?: number;
  autoPublish?: boolean;
  role?: string;
}

export function LiveKitRoomWrapper({
  roomName,
  user,
  children,
  className = '',
  showLocalVideo = true,
  maxParticipants = 6,
  autoPublish = true,
  role
}: LiveKitRoomWrapperProps) {
  const { connect, isConnected, isConnecting, error } = useLiveKit();

  useEffect(() => {
    // Auto-connect on mount
    connect(roomName, user, { autoPublish, role }).catch(err => {
      console.error('Failed to auto-connect:', err);
    });
  }, [roomName, user?.id, connect, autoPublish, role]);

  if (isConnecting) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
          <div className="text-sm">Connecting to stream...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-black border-2 border-red-500 ${className}`}>
        <div className="text-center text-red-400">
          <div className="text-2xl mb-2">❌</div>
          <div className="text-sm">Connection failed: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <VideoGrid
        showLocalVideo={showLocalVideo}
        maxParticipants={maxParticipants}
      />
      {children}
    </div>
  );
}