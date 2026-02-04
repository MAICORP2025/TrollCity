import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LiveKitRoom, RoomAudioRenderer, StartAudio } from '@livekit/components-react';
import '@livekit/components-styles';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { useLiveKitToken } from '../../hooks/useLiveKitToken';
import { useViewerTracking } from '../../hooks/useViewerTracking';
import { Stream } from '../../types/broadcast';
import BroadcastGrid from '../../components/broadcast/BroadcastGrid';
import BroadcastGridOverlay from '../../components/broadcast/BroadcastGridOverlay';
import HLSPlayer from '../../components/broadcast/HLSPlayer';
import BroadcastChat from '../../components/broadcast/BroadcastChat';
import BroadcastControls from '../../components/broadcast/BroadcastControls';
import GiftTray from '../../components/broadcast/GiftTray';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useStreamSeats } from '../../hooks/useStreamSeats';
import { useStreamEndListener } from '../../hooks/useStreamEndListener';

export default function BroadcastPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Stream End Listener
  useStreamEndListener({ 
      streamId: id || '',
      enabled: !!id,
      redirectToSummary: true
  });

  // Host Check
  const isHost = stream?.user_id === user?.id;

  // Seat System Hook
  const { seats, mySession, joinSeat, leaveSeat, kickParticipant } = useStreamSeats(id);

  // Mode Determination
  // Default to viewer. Switch to stage if Host OR in Active Seat.
  const mode = (isHost || (mySession?.status === 'active')) ? 'stage' : 'viewer';

  // LiveKit Token (Only enabled for Stage Mode)
  const { token, serverUrl } = useLiveKitToken({
    streamId: id,
    isHost,
    userId: user?.id,
    roomName: id,
    canPublish: true, // Stage participants always publish
    enabled: mode === 'stage' && !!stream
  });

  // Viewer Tracking
  useViewerTracking(id || '', isHost);

  // Gift Tray State
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);

  // Fetch Stream
  useEffect(() => {
    if (!id) return;
    const fetchStream = async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        console.error('Error fetching stream:', error);
        setLoading(false);
        return;
      }
      setStream(data);
      setLoading(false);
    };
    fetchStream();

    // Subscribe to Stream Updates (Box Count, Settings, etc.)
    const channel = supabase.channel(`broadcast_page_${id}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'streams',
                filter: `id=eq.${id}`
            },
            (payload) => {
                const newStream = payload.new as Stream;
                setStream(prev => prev ? { ...prev, ...newStream } : newStream);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [id]);

  // Handle Kick / Lawsuit
  useEffect(() => {
      if (mySession?.status === 'kicked') {
          toast.error("You have been kicked from the stage.", {
              action: {
                  label: "File Lawsuit (2x Refund)",
                  onClick: () => fileLawsuit(mySession.id)
              },
              duration: 10000 // Show for 10s (Grace Period is 10s too)
          });
      }
  }, [mySession?.status, mySession?.id]);

  const fileLawsuit = async (sessionId: string) => {
      const { data, error } = await supabase.rpc('file_seat_lawsuit', { p_session_id: sessionId });
      if (error || !data.success) {
          toast.error(data?.message || error?.message || "Failed to file lawsuit");
      } else {
          toast.success("Lawsuit filed with Troll City Court!");
      }
  };

  const handleJoinRequest = async (seatIndex: number) => {
      if (!user) {
          toast.error("Login required to join stage");
          return;
      }
      
      const price = stream?.seat_price || 0;
      
      if (price > 0) {
           // We could add a custom modal here, but confirm is fine for MVP
           if (confirm(`Join stage for ${price} Troll Coins?`)) {
               await joinSeat(seatIndex, price);
           }
      } else {
           await joinSeat(seatIndex, 0);
      }
  };

  if (loading) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-black text-white">
              <Loader2 className="animate-spin text-green-500" size={48} />
          </div>
      );
  }

  if (!stream) {
      return <div className="text-white text-center mt-20">Stream not found</div>;
  }

  // HLS URL Construction
  // Prompt: https://cdn.maitrollcity.com/.../*.m3u8
  // We use stream.id as the identifier for now.
  const hlsUrl = `https://cdn.maitrollcity.com/streams/${stream.id}.m3u8`;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
        
        {/* Main Stage / Video Area */}
        <div className="flex-1 relative flex flex-col bg-zinc-900">
            
            {/* STAGE MODE: LiveKit WebRTC */}
            {mode === 'stage' && token && serverUrl && (
                <LiveKitRoom
                    token={token}
                    serverUrl={serverUrl}
                    connect={true}
                    video={true}
                    audio={true}
                    className="flex-1 relative"
                >
                    <BroadcastGrid
                        stream={stream}
                        isHost={isHost}
                        mode="stage"
                        seats={seats}
                        onGift={(uid) => setGiftRecipientId(uid)}
                        onGiftAll={() => setGiftRecipientId('ALL')}
                        onJoinSeat={handleJoinRequest} // Not really used in stage mode
                        onKick={kickParticipant}
                    />
                    
                    {/* Controls Overlay */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center z-50 pointer-events-none">
                        <div className="pointer-events-auto">
                            <BroadcastControls 
                                stream={stream}
                                isHost={isHost}
                                chatOpen={true}
                                toggleChat={() => {}}
                                onGiftHost={() => setGiftRecipientId(stream.user_id)}
                                onLeave={isHost ? undefined : leaveSeat}
                            />
                        </div>
                    </div>
                    
                    <RoomAudioRenderer />
                    <StartAudio label="Click to allow audio" />
                </LiveKitRoom>
            )}

            {/* VIEWER MODE: HLS + Overlay */}
            {mode === 'viewer' && (
                <div className="flex-1 relative">
                    {/* HLS Player Background */}
                    <HLSPlayer 
                        src={hlsUrl} 
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                    
                    {/* Interactive Grid Overlay */}
                    <div className="absolute inset-0 z-10">
                        <BroadcastGridOverlay 
                            stream={stream}
                            isHost={isHost}
                            seats={seats}
                            onGift={(uid) => setGiftRecipientId(uid)}
                            onJoinSeat={handleJoinRequest}
                        />
                    </div>
                    
                    {/* Viewer Controls (Optional) */}
                    {/* Maybe just Gift Button? */}
                </div>
            )}
            
            {/* Gift Tray (Global) */}
            {giftRecipientId && (
                <div className="absolute bottom-0 left-0 right-0 z-50">
                    <GiftTray 
                        recipientId={giftRecipientId}
                        streamId={stream.id}
                        onClose={() => setGiftRecipientId(null)}
                    />
                </div>
            )}
        </div>

        {/* Sidebar: Chat & Leaderboard */}
        <div className="w-80 md:w-96 flex flex-col border-l border-white/10 bg-zinc-950/90 backdrop-blur-md z-40">
            <BroadcastChat 
                streamId={stream.id} 
                isHost={isHost} 
                isModerator={false} // TODO: Add mod logic
            />
        </div>

    </div>
  );
}
