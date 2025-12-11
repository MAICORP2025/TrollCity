import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack } from 'livekit-client';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { useLiveKitRoom } from '../hooks/useLiveKitRoom';

const OfficerLoungeStream = () => {
  const { user, profile } = useAuthStore();
  const [boxCount, setBoxCount] = useState(2);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const roomName = 'officer-stream';

  // Use unified LiveKit hook with proper role mapping
  const userForLiveKit = user ? {
    ...user,
    role: profile?.role || profile?.troll_role || 'viewer',
    troll_role: profile?.troll_role,
    level: profile?.level || 1
  } : null;

  const { room, participants, isConnecting, connect, disconnect } = useLiveKitRoom(
    roomName,
    userForLiveKit
  );

  // Officer access validation
  useEffect(() => {
    if (!profile || !user) return;

    const allowedRoles = ['admin', 'lead_troll_officer', 'troll_officer'];
    const userRole = profile.role || profile.troll_role;

    if (!allowedRoles.includes(userRole)) {
      setAccessDenied(true);
      toast.error('Access Denied — Officers Only');
      return;
    }
  }, [profile, user]);



  // Get grid layout classes based on box count
  const getGridClasses = (count) => {
    switch (count) {
      case 1: return 'grid-cols-1';
      case 2: return 'grid-cols-2';
      case 3:
      case 4: return 'grid-cols-2';
      case 5:
      case 6: return 'grid-cols-3';
      default: return 'grid-cols-2';
    }
  };

  // Join a specific box
  const joinBox = async (boxNumber) => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    console.log('🎥 Attempting to join officer box:', boxNumber);
    console.log('👤 User role:', profile?.role || profile?.troll_role);
    console.log('🏠 Room state:', room?.state);

    if (!room) {
      console.log('🔌 Connecting to room first...');
      connect();
      // Wait a bit for connection
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (room && room.state === 'connected') {
      try {
        console.log('📡 Room connected, checking permissions...');

        // Check if we can publish
        const canPublish = room.localParticipant?.permissions?.canPublish;
        console.log('🔐 Can publish:', canPublish);

        if (!canPublish) {
          toast.error('You do not have permission to broadcast in this room');
          return;
        }

        // Update participant metadata with position
        if (room.localParticipant) {
          room.localParticipant.setMetadata(JSON.stringify({
            position: boxNumber.toString(),
            roomType: 'officer'
          }));
        }

        console.log('🎬 Creating media tracks...');

        // Publish local tracks
        const [videoTrack, audioTrack] = await Promise.all([
          createLocalVideoTrack({ facingMode: 'user' }),
          createLocalAudioTrack()
        ]);

        console.log('📤 Publishing video track...');
        await room.localParticipant.publishTrack(videoTrack);

        console.log('📤 Publishing audio track...');
        await room.localParticipant.publishTrack(audioTrack);

        console.log('✅ Successfully joined officer box!');
        toast.success(`Joined Officer Box ${boxNumber}!`);
      } catch (err) {
        console.error('❌ Error publishing tracks:', err);
        console.error('Error details:', err.message, err.code, err.name);

        if (err.message?.includes('insufficient permissions')) {
          toast.error('Permission denied: You cannot broadcast in this room. Contact an admin.');
        } else if (err.message?.includes('NotAllowedError')) {
          toast.error('Camera/microphone access denied. Please allow access and try again.');
        } else {
          toast.error(`Failed to start camera/microphone: ${err.message}`);
        }
      }
    } else {
      console.log('❌ Room not connected or not available');
      toast.error('Failed to connect to officer stream room');
    }
  };

  // Leave current box
  const leaveBox = () => {
    disconnect();
  };

  // Render individual box
  const renderBox = (boxNumber) => {
    const participant = participants[boxNumber];

    return (
      <div key={boxNumber} className="relative bg-black rounded-xl overflow-hidden aspect-video">
        {participant ? (
          // Active participant
          <div className="w-full h-full">
            <VideoRenderer
              participant={participant}
              position={boxNumber}
            />
            <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Officer Box {boxNumber}
            </div>
            <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs">
              OFFICER LIVE
            </div>
          </div>
        ) : (
          // Waiting state
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <Shield className="w-12 h-12 mb-4 text-blue-400" />
            <div className="text-lg font-semibold">Waiting for Officer...</div>
            <div className="text-sm mb-4">Officer Box {boxNumber}</div>
            <button
              onClick={() => joinBox(boxNumber)}
              disabled={isConnecting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              {isConnecting ? 'Connecting...' : `Join Officer Box ${boxNumber}`}
            </button>
          </div>
        )}
      </div>
    );
  };

  // Access denied screen
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-900 to-black text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <Shield className="w-20 h-20 mx-auto mb-6 text-red-400" />
          <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
          <p className="text-xl text-red-200 mb-2">Officers Only</p>
          <p className="text-gray-300">
            This area is restricted to Troll Officers and Lead Troll Officers only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Shield className="w-10 h-10 text-blue-400" />
            OFFICER STREAM — MULTI-BOX VIEW
          </h1>
          <p className="text-gray-300">Exclusive officer streaming with LiveKit</p>
          {profile && (
            <div className="text-blue-300 text-sm mt-2">
              <p>Officer: {profile.username}</p>
              <p>Role: {profile.role || profile.troll_role}</p>
            </div>
          )}
        </div>


        {/* Box Count Selector */}
        <div className="bg-[#111320] border border-blue-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <label className="text-lg font-semibold">Number of Officer Boxes: {boxCount}</label>
            <div className="flex gap-2">
              <button
                onClick={() => setBoxCount(Math.max(1, boxCount - 1))}
                className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
                disabled={boxCount <= 1}
              >
                -
              </button>
              <button
                onClick={() => setBoxCount(Math.min(6, boxCount + 1))}
                className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
                disabled={boxCount >= 6}
              >
                +
              </button>
            </div>
          </div>
          
          <input
            type="range"
            min="1"
            max="6"
            value={boxCount}
            onChange={(e) => setBoxCount(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>1 Box</span>
            <span>2 Boxes</span>
            <span>3 Boxes</span>
            <span>4 Boxes</span>
            <span>5 Boxes</span>
            <span>6 Boxes</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-4">
            <p className="text-red-200">Error: {error}</p>
          </div>
        )}

        {/* Video Grid */}
        <div className={`grid gap-4 ${getGridClasses(boxCount)}`}>
          {Array.from({ length: boxCount }, (_, i) => renderBox(i + 1))}
        </div>

        {/* Current Status */}
        {room && (
          <div className="bg-green-900/50 border border-green-500 rounded-xl p-4 text-center">
            <p className="text-green-200 font-semibold flex items-center justify-center gap-2">
              <Shield className="w-5 h-5" />
              ✅ Connected to Officer LiveKit room. You are broadcasting!
            </p>
            <button
              onClick={leaveBox}
              className="mt-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
            >
              Leave Officer Stream
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-[#111320] border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Officer Stream Guidelines:
          </h3>
          <ul className="space-y-2 text-gray-300">
            <li>• This area is exclusively for authorized officers (Admin, Lead Troll Officers, Troll Officers)</li>
            <li>• Select the number of streaming boxes (1-6)</li>
            <li>• Click "Join Officer Box" on any empty box to start broadcasting</li>
            <li>• Each box represents a different officer broadcaster position</li>
            <li>• Uses unified LiveKit room: "officer-stream"</li>
            <li>• Turn on camera and microphone to appear in your assigned box</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// VideoRenderer component for displaying participant video
const VideoRenderer = ({ participant, position }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const handleTrackSubscribed = (track, publication) => {
      if (track.kind === 'video' && videoRef.current) {
        track.attach(videoRef.current);
      }
    };

    const handleTrackUnsubscribed = (track) => {
      track.detach();
    };

    // Subscribe to existing tracks
    participant.tracks.forEach((publication) => {
      if (publication.track) {
        handleTrackSubscribed(publication.track, publication);
      }
    });

    // Listen for new tracks
    participant.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    participant.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    return () => {
      participant.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      participant.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      
      // Clean up tracks
      participant.tracks.forEach((publication) => {
        if (publication.track) {
          publication.track.detach();
        }
      });
    };
  }, [participant]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
};

export default OfficerLoungeStream;
