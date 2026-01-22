import React, { useEffect, useState, useCallback } from 'react';
import { Room } from 'livekit-client';
import TopLiveBar from './TopLiveBar';
import FloatingActionCluster from './FloatingActionCluster';
import ParticipantStrip from './ParticipantStrip';
import ChatBottomSheet from './ChatBottomSheet';
import MoreControlsDrawer, { MoreControlsConfig } from './MoreControlsDrawer';

interface Message {
  id: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  avatarUrl?: string | null;
}

interface BroadcastParticipant {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isActive?: boolean;
}

interface MobileBroadcastLayoutProps {
  room: Room;
  isLive: boolean;
  timer: string;
  viewerCount: number;
  isMuted: boolean;
  isCameraOn: boolean;
  messages: Message[];
  participants: BroadcastParticipant[];
  unreadChatCount?: number;
  videoContainerRef?: React.RefObject<HTMLDivElement>;
  children?: React.ReactNode;
  // Callbacks
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onEffectsClick: () => void;
  onInviteGuest: () => void;
  onParticipantClick?: (participant: BroadcastParticipant) => void;
  onSendMessage: (content: string) => void;
  onFlyingChatsToggle?: (enabled: boolean) => void;
  onBattlesToggle?: (enabled: boolean) => void;
  onAddGuest?: () => void;
  onBroadcastSettings?: () => void;
  onThemeChange?: (theme: 'purple' | 'neon' | 'rgb') => void;
  className?: string;
}

export default function MobileBroadcastLayout({
  room: _room,
  isLive,
  timer,
  viewerCount,
  isMuted,
  isCameraOn,
  messages,
  participants,
  unreadChatCount = 0,
  videoContainerRef,
  children,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onEffectsClick,
  onInviteGuest,
  onParticipantClick,
  onSendMessage,
  onFlyingChatsToggle,
  onBattlesToggle,
  onAddGuest,
  onBroadcastSettings,
  onThemeChange,
  className = ''
}: MobileBroadcastLayoutProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localUnreadCount, setLocalUnreadCount] = useState(unreadChatCount);
  const [config, setConfig] = useState<MoreControlsConfig>({
    showFlyingChats: true,
    enableBattles: false,
    theme: 'purple'
  });

  // Track unread messages
  useEffect(() => {
    if (!isChatOpen && messages.length > 0) {
      setLocalUnreadCount((prev) => prev + 1);
    }
  }, [messages, isChatOpen]);

  // Clear unread when opening chat
  useEffect(() => {
    if (isChatOpen) {
      setLocalUnreadCount(0);
    }
  }, [isChatOpen]);

  const handleChatOpen = useCallback(() => {
    setIsChatOpen(true);
    setLocalUnreadCount(0);
  }, []);

  const handleChatClose = useCallback(() => {
    setIsChatOpen(false);
  }, []);

  const handleSendMessage = useCallback(
    (content: string) => {
      onSendMessage(content);
    },
    [onSendMessage]
  );

  const handleFlyingChatsToggle = useCallback(
    (enabled: boolean) => {
      setConfig((prev) => ({ ...prev, showFlyingChats: enabled }));
      onFlyingChatsToggle?.(enabled);
    },
    [onFlyingChatsToggle]
  );

  const handleBattlesToggle = useCallback(
    (enabled: boolean) => {
      setConfig((prev) => ({ ...prev, enableBattles: enabled }));
      onBattlesToggle?.(enabled);
    },
    [onBattlesToggle]
  );

  const handleThemeChange = useCallback(
    (theme: 'purple' | 'neon' | 'rgb') => {
      setConfig((prev) => ({ ...prev, theme }));
      onThemeChange?.(theme);
    },
    [onThemeChange]
  );

  return (
    <div className={`broadcast-mobile-container broadcast-mobile-layout-active ${className}`}>
      {/* Video Stage Area */}
      <div className="broadcast-video-stage">
        <div className="broadcast-video-container" ref={videoContainerRef}>
          {children}
        </div>

        {/* Top Live Bar */}
        <TopLiveBar
          isLive={isLive}
          timer={timer}
          viewerCount={viewerCount}
          onMoreClick={() => setIsDrawerOpen(true)}
        />

        {/* Floating Action Cluster */}
        <FloatingActionCluster
          isMuted={isMuted}
          onToggleMic={onToggleMic}
          isCameraOn={isCameraOn}
          onToggleCamera={onToggleCamera}
          onFlipCamera={onFlipCamera}
          onEffectsClick={onEffectsClick}
        />

        {/* Participant Strip */}
        <ParticipantStrip
          participants={participants}
          onInviteClick={onInviteGuest}
          onParticipantClick={onParticipantClick}
        />
      </div>

      {/* Chat Bottom Bar */}
      <div
        className="broadcast-chat-bar"
        onClick={handleChatOpen}
      >
        <div className="broadcast-chat-placeholder">
          <span className="broadcast-chat-placeholder-icon">💬</span>
          <span>Tap to chat</span>
        </div>
        {localUnreadCount > 0 && (
          <div className="broadcast-chat-unread">{localUnreadCount}</div>
        )}
        <button className="broadcast-chat-send-icon" onClick={handleChatOpen}>
          →
        </button>
      </div>

      {/* Chat Bottom Sheet */}
      <ChatBottomSheet
        isOpen={isChatOpen}
        messages={messages}
        unreadCount={localUnreadCount}
        onSendMessage={handleSendMessage}
        onClose={handleChatClose}
      />

      {/* More Controls Drawer */}
      <MoreControlsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        config={config}
        onFlyingChatsToggle={handleFlyingChatsToggle}
        onBattlesToggle={handleBattlesToggle}
        onAddGuest={onAddGuest || onInviteGuest}
        onSettings={onBroadcastSettings || (() => {})}
        onThemeChange={handleThemeChange}
      />
    </div>
  );
}
