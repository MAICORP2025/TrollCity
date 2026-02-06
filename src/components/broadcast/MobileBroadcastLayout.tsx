import React, { useState } from 'react';
import { Stream, ChatMessage } from '../../types/broadcast';
import TopLiveBar from './TopLiveBar';
import FloatingActionCluster from './FloatingActionCluster';
import ChatBottomSheet from './ChatBottomSheet';
import MoreControlsDrawer from './MoreControlsDrawer';
import ParticipantStrip from './ParticipantStrip';
import { SeatSession } from '../../hooks/useStreamSeats';

interface MobileBroadcastLayoutProps {
  stream: Stream;
  isHost: boolean;
  messages: ChatMessage[];
  seats: Record<number, SeatSession>;
  children: React.ReactNode; // The video/grid content
  onSendMessage: (text: string) => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onFlipCamera: () => void;
  onLeave: () => void;
  onJoinSeat: (index: number) => void;
  hostGlowingColor?: string;
}

export default function MobileBroadcastLayout({
  stream,
  isHost,
  messages,
  seats,
  children,
  onSendMessage,
  onToggleMic,
  onToggleCamera,
  onFlipCamera,
  onLeave,
  onJoinSeat,
  hostGlowingColor
}: MobileBroadcastLayoutProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // Local state for UI toggle simulation if needed
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Handlers wrapper
  const handleToggleMic = () => {
      setIsMuted(!isMuted);
      onToggleMic();
  };

  const handleToggleCamera = () => {
      setIsCameraOff(!isCameraOff);
      onToggleCamera();
  };

  return (
    <div className="relative h-[100dvh] w-full bg-black overflow-hidden flex flex-col font-sans text-white">
      
      {/* 1. Background Video Layer */}
      <div className="absolute inset-0 z-0">
         {children}
      </div>

      {/* 2. Gradient Overlay for readability */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/60 z-10" />

      {/* 3. Top Bar */}
      <TopLiveBar 
        stream={stream} 
        hostName={stream.user_id === isHost ? 'You' : 'Host'} // Replace with actual username lookup if available
        hostGlowingColor={hostGlowingColor}
        onClose={onLeave}
        className="z-20"
      />

      {/* 4. Middle Area (Empty for interactions) */}
      <div className="flex-1 relative z-20 pointer-events-none">
         {/* Participant Strip (Guests) */}
         <div className="absolute top-20 left-0 right-0 pointer-events-auto">
             <ParticipantStrip seats={seats} onJoinRequest={onJoinSeat} />
         </div>
      </div>

      {/* 5. Bottom Area */}
      <div className="w-full z-20 flex flex-col justify-end pb-safe-bottom">
         
         <div className="flex items-end justify-between px-4 pb-2">
             {/* Chat Area (Left/Center) */}
             <div className="flex-1 mr-12 pointer-events-none">
                 <ChatBottomSheet 
                    messages={messages} 
                    onSendMessage={onSendMessage} 
                    className="pointer-events-auto"
                 />
             </div>

             {/* Right Action Cluster */}
             <div className="pb-4 pointer-events-auto">
                <FloatingActionCluster 
                    isHost={isHost}
                    onMenu={() => setIsDrawerOpen(true)}
                    onLike={() => {}}
                    onGift={() => {}}
                    onShare={() => {}}
                />
            </div>
         </div>
      </div>

      <MoreControlsDrawer 
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onFlipCamera={onFlipCamera}
        onLeave={onLeave}
        isHost={isHost}
      />
    </div>
  );
}
