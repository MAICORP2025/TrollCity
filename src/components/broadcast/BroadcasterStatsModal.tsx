import React, { useState, useEffect, useCallback } from 'react';
import { X, Video, VideoOff, Mic, MicOff, SwitchCamera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useStreamRealtime } from '../../hooks/useStreamRealtime';

interface BroadcasterStatsModalProps {
  stream: any;
  onClose: () => void;
  broadcasterProfile: any;
  isCameraOn?: boolean;
  isMicOn?: boolean;
  onToggleCamera?: () => void;
  onToggleMic?: () => void;
  onFlipCamera?: () => void;
  cameraFacingMode?: 'user' | 'environment';
}

export default function BroadcasterStatsModal({
  stream,
  onClose,
  broadcasterProfile: _broadcasterProfile,
  isCameraOn: initialCameraOn = true,
  isMicOn: initialMicOn = true,
  onToggleCamera,
  onToggleMic,
  onFlipCamera,
  cameraFacingMode = 'user'
}: BroadcasterStatsModalProps) {
  const [isCameraOn, setIsCameraOn] = useState(initialCameraOn);
  const [isMicOn, setIsMicOn] = useState(initialMicOn);
  const [stats, setStats] = useState({
    status: stream?.status || 'live',
    viewers: Number(stream?.current_viewers ?? stream?.viewer_count ?? 0),
    duration: '--:--:--',
    likes: Number(stream?.total_likes ?? stream?.like_count ?? 0),
    coinsEarned: Number(stream?.total_gifts_coins ?? stream?.coin_earnings ?? 0),
    chatMessages: 0,
    onStage: 0,
  });

  // Update state when props change
  useEffect(() => {
    setIsCameraOn(initialCameraOn);
  }, [initialCameraOn]);

  useEffect(() => {
    setIsMicOn(initialMicOn);
  }, [initialMicOn]);

  const streamStartedAt = stream?.started_at || stream?.created_at;

  const refreshStats = useCallback(async () => {
    if (!stream?.id) return;

    const [{ data: streamData }, { count: messageCount }, { count: seatCount }, { count: participantCount }] = await Promise.all([
      supabase
        .from('streams')
        .select('status,current_viewers,viewer_count,total_likes,total_gifts_coins,started_at,created_at')
        .eq('id', stream.id)
        .maybeSingle(),
      supabase
        .from('stream_messages')
        .select('id', { count: 'exact', head: true })
        .eq('stream_id', stream.id),
      supabase
        .from('stream_seat_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('stream_id', stream.id)
        .eq('status', 'active'),
      supabase
        .from('stream_participants')
        .select('id', { count: 'exact', head: true })
        .eq('stream_id', stream.id)
        .eq('is_active', true),
    ]);

    const liveStream = streamData || stream;
    const storedViewers = Number(liveStream?.current_viewers ?? liveStream?.viewer_count ?? 0);
    setStats((prev) => ({
      ...prev,
      status: liveStream?.status || 'live',
      viewers: Math.max(storedViewers, Number(participantCount ?? 0)),
      likes: Number(liveStream?.total_likes ?? liveStream?.like_count ?? 0),
      coinsEarned: Number(liveStream?.total_gifts_coins ?? liveStream?.coin_earnings ?? 0),
      chatMessages: Number(messageCount ?? prev.chatMessages ?? 0),
      onStage: Number(seatCount ?? prev.onStage ?? 0),
    }));
  }, [stream]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useStreamRealtime(stream?.id, {
    onStream: refreshStats,
    onMessage: refreshStats,
    onGift: refreshStats,
    onParticipant: refreshStats,
  });

  useEffect(() => {
    if (!streamStartedAt) return;

    const updateDuration = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(streamStartedAt).getTime()) / 1000));
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      setStats((prev) => ({
        ...prev,
        duration: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
      }));
    };

    updateDuration();
    const timer = setInterval(updateDuration, 1000);
    return () => clearInterval(timer);
  }, [streamStartedAt]);

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
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={async () => {
              console.log('Toggle camera clicked');
              try {
                await onToggleCamera?.();
                // Optimistically update UI
                setIsCameraOn(!isCameraOn);
              } catch (error) {
                console.error('Failed to toggle camera:', error);
                setIsCameraOn(initialCameraOn);
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
              {isCameraOn ? 'Camera Off' : 'Camera On'}
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
                setIsMicOn(initialMicOn);
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
              {isMicOn ? 'Mic Off' : 'Mic On'}
            </span>
          </button>

          <button
            onClick={async () => {
              try {
                await onFlipCamera?.();
              } catch (error) {
                console.error('Failed to flip camera:', error);
              }
            }}
            disabled={!onFlipCamera}
            className="flex flex-col items-center gap-2 p-3 rounded-lg border transition-all bg-blue-500/20 border-blue-500/50 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SwitchCamera size={24} />
            <span className="text-sm font-medium">
              {cameraFacingMode === 'environment' ? 'Front Cam' : 'Rear Cam'}
            </span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Stream Status</span>
            <span className="text-green-400 font-medium">{stats.status === 'live' ? 'Live' : stats.status}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Viewer Count</span>
            <span className="text-white font-medium">{stats.viewers.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Stream Duration</span>
            <span className="text-white font-medium">{stats.duration}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Likes</span>
            <span className="text-white font-medium">{stats.likes.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Coins Earned</span>
            <span className="text-yellow-400 font-medium">{stats.coinsEarned.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Chat Messages</span>
            <span className="text-white font-medium">{stats.chatMessages.toLocaleString()}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">On Stage</span>
            <span className="text-white font-medium">{stats.onStage.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
