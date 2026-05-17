/**
 * MOBILE BROADCAST INTEGRATION GUIDE
 * 
 * How to integrate MobileBroadcastLayout into your LivePage
 * This guide shows the recommended patterns for using mobile-first components
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MobileBroadcastLayout from '../components/broadcast/MobileBroadcastLayout';
import BroadcastLayout from '../components/broadcast/BroadcastLayout'; // Desktop layout
import { Room } from 'livekit-client';

// ============================================================
// 1. HOOK FOR MOBILE/RESPONSIVE DETECTION
// ============================================================

/**
 * Custom hook to detect viewport and determine if we should show mobile layout
 * Breakpoints:
 * - xs: <= 360px (tiny phones)
 * - sm: 361px–480px
 * - md: 481px–768px (large phones / small tablets)
 * - lg: 769px–1024px (tablets)
 * - desktop: >= 1025px
 */
export function useMobileBreakpoint() {
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

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Return true if should show mobile layout
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

// ============================================================
// 2. TIMER HOOK
// ============================================================

/**
 * Hook to format elapsed time
 * Updates every second
 */
export function useLiveTimer(startTime: Date | null, isLive: boolean) {
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
// 3. EXAMPLE LIVEPAGE INTEGRATION
// ============================================================

interface ExampleLivePageProps {
  room: Room;
  // ... other props
}

export default function ExampleLivePage({ room }: ExampleLivePageProps) {
  const { streamId } = useParams<{ streamId: string }>();
  const { isMobile } = useMobileBreakpoint();
  
  // State
  const [isLive, setIsLive] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [viewerCount, setViewerCount] = useState(1234);
  const [broadcastStartTime] = useState(new Date());
  const timer = useLiveTimer(broadcastStartTime, isLive);

  // Chat and participants (stub with TODO)
  const [messages, setMessages] = useState<any[]>([
    {
      id: '1',
      userId: 'user1',
      username: 'John',
      content: 'Great stream!',
      timestamp: new Date(),
      avatarUrl: null
    }
  ]);

  const [participants, setParticipants] = useState<any[]>([
    {
      id: 'p1',
      username: 'Guest 1',
      avatarUrl: null,
      isActive: true
    }
  ]);

  // TODO: Replace with real implementations
  const handleToggleMic = useCallback(() => setIsMuted((prev) => !prev), []);
  const handleToggleCamera = useCallback(() => setIsCameraOn((prev) => !prev), []);
  const handleFlipCamera = useCallback(() => {
    console.log('Flip camera');
    // TODO: Implement camera flip
  }, []);
  const handleEffectsClick = useCallback(() => {
    console.log('Open effects');
    // TODO: Open effects menu
  }, []);
  const handleInviteGuest = useCallback(() => {
    console.log('Invite guest');
    // TODO: Show invite guest modal
  }, []);
  const handleSendMessage = useCallback((content: string) => {
    // TODO: Send message via Supabase
    const newMessage = {
      id: `msg-${Date.now()}`,
      userId: 'current-user',
      username: 'You',
      content,
      timestamp: new Date(),
      avatarUrl: null
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  // Optional callbacks for drawer controls
  const handleFlyingChatsToggle = useCallback((enabled: boolean) => {
    console.log('Flying chats:', enabled);
    // TODO: Save to user preferences
  }, []);

  const handleBattlesToggle = useCallback((enabled: boolean) => {
    console.log('Battles enabled:', enabled);
    // TODO: Toggle battles feature
  }, []);

  const handleThemeChange = useCallback((theme: 'purple' | 'neon' | 'rgb') => {
    console.log('Theme changed to:', theme);
    // TODO: Apply theme globally
  }, []);

  // ============================================================
  // CONDITIONAL RENDERING
  // ============================================================

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
        // Callbacks
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onFlipCamera={handleFlipCamera}
        onEffectsClick={handleEffectsClick}
        onInviteGuest={handleInviteGuest}
        onSendMessage={handleSendMessage}
        onFlyingChatsToggle={handleFlyingChatsToggle}
        onBattlesToggle={handleBattlesToggle}
        onThemeChange={handleThemeChange}
      >
        {/* Your video element or video grid goes here */}
        <video
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </MobileBroadcastLayout>
    );
  }

  // Desktop layout (keep existing implementation)
  return (
    <BroadcastLayout
      room={room}
      streamId={streamId}
      broadcasterId="current-broadcaster-id"
      isHost={true}
      // ... other desktop-specific props
    >
      {/* Desktop video grid */}
    </BroadcastLayout>
  );
}

// ============================================================
// 4. TYPES FOR STATE MANAGEMENT
// ============================================================

/**
 * If using Redux/Zustand, consider this structure:
 */
interface BroadcastState {
  // Stream state
  streamId: string | null;
  isLive: boolean;
  startTime: Date | null;
  viewerCount: number;
  
  // Broadcaster state
  isMuted: boolean;
  isCameraOn: boolean;
  
  // Chat
  messages: Array<{
    id: string;
    userId: string;
    username: string;
    content: string;
    timestamp: Date;
    avatarUrl?: string | null;
  }>;
  
  // Participants
  activeParticipants: Array<{
    id: string;
    username: string;
    avatarUrl?: string | null;
    isActive: boolean;
  }>;
  
  // Settings
  preferences: {
    showFlyingChats: boolean;
    enableBattles: boolean;
    theme: 'purple' | 'neon' | 'rgb';
  };
}

// ============================================================
// 5. CSS IMPORTANT NOTES
// ============================================================

/**
 * The mobile-broadcast.css file includes:
 * 
 * BREAKPOINTS (Mobile First):
 * - xs: <= 360px (tiny phones)
 * - sm: 361px–480px
 * - md: 481px–768px
 * - lg: 769px–1024px
 * - desktop: >= 1025px
 * 
 * KEY CSS CLASSES:
 * 
 * 1. Container:
 *    .broadcast-mobile-container - Main wrapper
 *    .broadcast-mobile-layout-active - Suppresses bottom nav
 * 
 * 2. Video Stage:
 *    .broadcast-video-stage - Main video area
 *    .broadcast-video-container - Video element wrapper
 * 
 * 3. Top Bar:
 *    .broadcast-top-bar - Minimal top controls
 *    .broadcast-live-badge - Live + pulsing dot
 *    .broadcast-timer - Elapsed time
 *    .broadcast-viewer-count - Viewer count
 *    .broadcast-more-button - "⋮" menu button
 * 
 * 4. Floating Actions:
 *    .broadcast-floating-cluster - Right side buttons
 *    .broadcast-action-button - Individual action button
 *    .broadcast-action-button.active - Active state (glow)
 * 
 * 5. Participant Strip:
 *    .broadcast-participant-strip - Horizontal scroll area
 *    .broadcast-participant-tile - Individual participant
 *    .broadcast-invite-button - Invite guest button
 * 
 * 6. Chat Bottom Bar (Collapsed):
 *    .broadcast-chat-bar - Tap to expand
 *    .broadcast-chat-placeholder - "Tap to chat" text
 *    .broadcast-chat-unread - Unread count badge
 * 
 * 7. Chat Sheet (Expanded):
 *    .broadcast-chat-sheet - Full sheet overlay
 *    .broadcast-chat-messages - Message list
 *    .broadcast-chat-input-area - Input + send button
 * 
 * 8. Drawer:
 *    .broadcast-drawer - Settings drawer
 *    .broadcast-drawer-item - Individual control item
 *    .broadcast-drawer-item.active - Active toggle
 * 
 * SAFE AREA HANDLING:
 * All elements use env(safe-area-inset-*) for notched devices
 * 
 * GLOW/EFFECTS:
 * Only applied to active/selected elements for emphasis
 * Subtle shadows: 0 2px 8px rgba(0, 0, 0, 0.3)
 * Glow only on active: box-shadow: 0 0 12px rgba(167, 139, 250, 0.4)
 * 
 * TAP TARGETS:
 * Minimum 44px (action buttons 44-48px on mobile)
 * Increased to 52px on tablets
 */

// ============================================================
// 6. QUICK REFERENCE - WHAT YOU NEED TO UPDATE
// ============================================================

/**
 * TODO CHECKLIST:
 * 
 * [ ] Import MobileBroadcastLayout in LivePage
 * [ ] Add useMobileBreakpoint hook
 * [ ] Add useLiveTimer hook (or use existing)
 * [ ] Wire up all callbacks:
 *     - onToggleMic / onToggleCamera / onFlipCamera
 *     - onEffectsClick
 *     - onInviteGuest
 *     - onSendMessage
 *     - onFlyingChatsToggle
 *     - onBattlesToggle
 *     - onThemeChange
 * [ ] Map your actual message/participant data
 * [ ] Test on mobile (dev tools + real devices)
 * [ ] Test all breakpoints (xs, sm, md, lg, desktop)
 * [ ] Verify safe areas on notched devices (iPhone, etc)
 * [ ] Test bottom nav suppression during live
 * [ ] Verify chat sheet scrolls properly
 * [ ] Test drawer open/close animations
 * 
 * OPTIONAL ENHANCEMENTS:
 * [ ] Add message persistence (Supabase real-time)
 * [ ] Add participant list updates
 * [ ] Add viewer count updates (poll or real-time)
 * [ ] Integrate with existing effects system
 * [ ] Add haptic feedback on button clicks
 * [ ] Add theme persistence
 * [ ] Add streaming quality selector in drawer
 */
