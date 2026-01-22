/**
 * QUICK START - Mobile Broadcast Integration
 * Copy-paste ready example showing how to integrate MobileBroadcastLayout
 * into your existing LivePage component. Keep content/routes untouched.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Room } from 'livekit-client';

import MobileBroadcastLayout from './src/components/broadcast/MobileBroadcastLayout';
import BroadcastLayout from './src/components/broadcast/BroadcastLayout';
import ResponsiveVideoGrid from './src/components/stream/ResponsiveVideoGrid';

// ============================================================
// STEP 1: Helper hooks
// ============================================================

function useMobileBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<'xs' | 'sm' | 'md' | 'lg' | 'desktop'>('desktop');

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width <= 360) setBreakpoint('xs');
      else if (width <= 480) setBreakpoint('sm');
      else if (width <= 768) setBreakpoint('md');
      else if (width <= 1024) setBreakpoint('lg');
      else setBreakpoint('desktop');
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile: breakpoint !== 'desktop',
    breakpoint,
    isXs: breakpoint === 'xs',
    isSm: breakpoint === 'sm',
    isMd: breakpoint === 'md',
    isLg: breakpoint === 'lg',
    isDesktop: breakpoint === 'desktop'
  };
}

function useLiveTimer(startTime: Date | null, isLive: boolean) {
  const [timer, setTimer] = useState('00:00:00');

  useEffect(() => {
    if (!isLive || !startTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      setTimer(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isLive]);

  return timer;
}

// ============================================================
// STEP 2: Your existing LivePage component (example wiring)
// ============================================================

interface LivePageProps {
  room: Room;
  // ... other props
}

export default function LivePage({ room }: LivePageProps) {
  const { streamId } = useParams<{ streamId: string }>();
  const videoRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useMobileBreakpoint();

  const [isLive] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [viewerCount] = useState(1234);
  const [broadcastStartTime] = useState(new Date());

  const [messages, setMessages] = useState<any[]>([
    {
      id: '1',
      userId: 'user1',
      username: 'TrollMaster',
      content: 'Loving the broadcast!',
      timestamp: new Date(),
      avatarUrl: null
    }
  ]);

  const [participants] = useState<any[]>([
    { id: 'p1', username: 'Guest 1', avatarUrl: null, isActive: true },
    { id: 'p2', username: 'Guest 2', avatarUrl: null, isActive: true }
  ]);

  const timer = useLiveTimer(broadcastStartTime, isLive);

  const handleToggleMic = useCallback(() => {
    setIsMuted((prev) => !prev);
    console.log('Mic toggled:', !isMuted);
  }, [isMuted]);

  const handleToggleCamera = useCallback(() => {
    setIsCameraOn((prev) => !prev);
    console.log('Camera toggled:', !isCameraOn);
  }, [isCameraOn]);

  const handleFlipCamera = useCallback(() => {
    console.log('Flip camera');
  }, []);

  const handleEffectsClick = useCallback(() => {
    console.log('Open effects menu');
  }, []);

  const handleInviteGuest = useCallback(() => {
    console.log('Invite guest');
  }, []);

  const handleParticipantClick = useCallback((participant: any) => {
    console.log('Participant clicked:', participant.username);
  }, []);

  const handleSendMessage = useCallback((content: string) => {
    const newMessage = {
      id: `msg-${Date.now()}`,
      userId: 'current-user-id',
      username: 'You',
      content,
      timestamp: new Date(),
      avatarUrl: null
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const handleFlyingChatsToggle = useCallback((enabled: boolean) => {
    console.log('Flying chats:', enabled);
  }, []);

  const handleBattlesToggle = useCallback((enabled: boolean) => {
    console.log('Battles enabled:', enabled);
  }, []);

  const handleThemeChange = useCallback((theme: 'purple' | 'neon' | 'rgb') => {
    console.log('Theme changed:', theme);
  }, []);

  const handleBroadcastSettings = useCallback(() => {
    console.log('Open broadcast settings');
  }, []);

  if (isMobile) {
    return (
      <MobileBroadcastLayout
        room={room}
        isLive={isLive}
        timer={timer}
        viewerCount={viewerCount}
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        messages={messages}
        participants={participants}
        unreadChatCount={0}
        videoContainerRef={videoRef}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onFlipCamera={handleFlipCamera}
        onEffectsClick={handleEffectsClick}
        onInviteGuest={handleInviteGuest}
        onParticipantClick={handleParticipantClick}
        onSendMessage={handleSendMessage}
        onFlyingChatsToggle={handleFlyingChatsToggle}
        onBattlesToggle={handleBattlesToggle}
        onAddGuest={handleInviteGuest}
        onBroadcastSettings={handleBroadcastSettings}
        onThemeChange={handleThemeChange}
      >
        <ResponsiveVideoGrid participants={participants} />
      </MobileBroadcastLayout>
    );
  }

  return (
    <BroadcastLayout
      room={room}
      streamId={streamId}
      broadcasterId="current-broadcaster-id"
      isHost
    >
      <ResponsiveVideoGrid participants={participants} />
    </BroadcastLayout>
  );
}

// ============================================================
// STEP 5: Real-time hooks (placeholder examples)
// ============================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useRealtimeViewerCount(streamId: string | undefined) {
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    if (!streamId) return;
    setViewerCount((prev) => prev);
  }, [streamId]);

  return viewerCount;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRealtimeMessages(streamId: string | undefined) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!streamId) return;
    setMessages((prev) => prev);
  }, [streamId]);

  return messages;
}
