import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  lazy,
  Suspense
} from 'react';
import { useParams } from 'react-router-dom';
import { useLiveKit } from '../hooks/useLiveKit';
import { useAuthStore } from '../lib/store';
import { supabase, UserProfile } from '../lib/supabase';
import { toast } from 'sonner';
import { useViewerTracking } from '../hooks/useViewerTracking';
import { useStream } from '../hooks/useQueries';
import ChatBox from '../components/broadcast/ChatBox';
import GiftBox from '../components/broadcast/GiftBox';
import GiftEventOverlay from './GiftEventOverlay';
import { useGiftEvents } from '../lib/hooks/useGiftEvents';
import EntranceEffect from '../components/broadcast/EntranceEffect';
import BroadcastLayout from '../components/broadcast/BroadcastLayout';
import BroadcastOverlays from '../components/stream/BroadcastOverlays';
import { useSeatRoster } from '../hooks/useSeatRoster';
import SeatCostPopup from '../components/broadcast/SeatCostPopup';
import BroadcastLayoutPreview, { ViewerLayoutPreview } from '../components/broadcast/BroadcastPreview';

// Lazy load heavy modals
const GiftModal = lazy(() => import('../components/broadcast/GiftModal'));
const ProfileModal = lazy(() => import('../components/broadcast/ProfileModal'));
const CoinStoreModal = lazy(() => import('../components/broadcast/CoinStoreModal'));

// Constants
const STREAM_POLL_INTERVAL = 2000;

interface StreamData {
  id: string;
  broadcaster_id: string;
  title: string;
  status: string;
  is_live: boolean;
  total_likes: number;
  current_viewers: number;
  total_gifts_coins: number;
  created_at: string;
  is_private?: boolean;
}

export default function BroadcastPage() {
  const { streamId } = useParams();
  const { user, profile } = useAuthStore();

  // Use React Query for stream data
  const { data: stream, isLoading: streamLoading } = useStream(streamId || '');
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState<any>(null);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [isCoinStoreOpen, setIsCoinStoreOpen] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [seatCostPopupVisible, setSeatCostPopupVisible] = useState(false);
  const [seatCost, setSeatCost] = useState<number>(0);
  const [joinPrice, setJoinPrice] = useState<number>(0);
  const [privateAccessGranted, setPrivateAccessGranted] = useState(false);
  const [privatePasswordInput, setPrivatePasswordInput] = useState('');
  const [privateAuthError, setPrivateAuthError] = useState('');
  const micRestrictionInfo = useMemo(() => {
    if (!profile?.mic_muted_until) {
      return { isMuted: false, message: '' };
    }
    const until = Date.parse(profile.mic_muted_until);
    if (Number.isNaN(until) || until <= Date.now()) {
      return { isMuted: false, message: '' };
    }
    return {
      isMuted: true,
      message: `Microphone disabled until ${new Date(until).toLocaleString()}`,
    };
  }, [profile?.mic_muted_until]);
  const privateAccessStorageKey = streamId ? `private-stream-access:${streamId}` : null;
  const [entranceEffect, setEntranceEffect] = useState<any>(null);
  const entranceTimerRef = useRef<number | null>(null);
  const prevSeatUsersRef = useRef<Set<string>>(new Set());
  const seatSyncRef = useRef(false);
  const connectedRef = useRef(false);
  const [cachedPrivatePassword, setCachedPrivatePassword] = useState<string | null>(null);
  const privatePasswordStorageKey = streamId ? `private-stream-password:${streamId}` : null;
  
  // LiveKit
  const liveKit = useLiveKit();

  // Seat Roster
  const { seats, claimSeat, currentOccupants } = useSeatRoster(streamId || '');

  // Derived
  const isBroadcaster = user?.id === stream?.broadcaster_id;
  const isGuestSeat = !isBroadcaster && seats.some(seat => seat?.user_id === user?.id);

  // Load stream
  const handlePrivatePasswordSubmit = async () => {
    setPrivateAuthError('');
    if (!streamId) {
      setPrivateAuthError('Stream missing');
      return;
    }
    if (!user) {
      setPrivateAuthError('Please log in first');
      return;
    }
    if (!privatePasswordInput.trim()) {
      setPrivateAuthError('Enter the password to join this stream');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('verify_stream_password', {
        p_stream_id: streamId,
        p_password: privatePasswordInput.trim(),
      });

      if (error) {
        throw error;
      }

      if (data?.success) {
        setPrivateAccessGranted(true);
        if (privateAccessStorageKey) {
          localStorage.setItem(privateAccessStorageKey, '1');
        }
        setPrivateAuthError('');
        toast.success('Private access granted');
      } else {
        setPrivateAuthError('Incorrect password');
      }
    } catch (err: any) {
      console.error('Private stream verification failed:', err);
      setPrivateAuthError('Unable to verify password right now');
    }
  };


  useEffect(() => {
    if (!stream || !streamId) {
      setPrivateAccessGranted(false);
      setPrivatePasswordInput('');
      setPrivateAuthError('');
      return;
    }

    if (!privateAccessStorageKey) {
      setPrivateAccessGranted(true);
      return;
    }

    if (stream.is_private && user?.id !== stream.broadcaster_id) {
      const stored = localStorage.getItem(privateAccessStorageKey);
      setPrivateAccessGranted(Boolean(stored));
    } else {
      setPrivateAccessGranted(true);
      if (privateAccessStorageKey) {
        localStorage.removeItem(privateAccessStorageKey);
      }
    }
  }, [stream, streamId, user?.id]);

  useEffect(() => {
    if (!privatePasswordStorageKey) {
      setCachedPrivatePassword(null);
      return;
    }

    if (!stream?.is_private || !isBroadcaster) {
      setCachedPrivatePassword(null);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const stored = localStorage.getItem(privatePasswordStorageKey);
    setCachedPrivatePassword(stored);
  }, [privatePasswordStorageKey, stream?.is_private, isBroadcaster]);

  // Join/Init LiveKit
  useEffect(() => {
    if (!streamId || !user || !profile) return;
    if (!stream) return;
    if (stream?.is_private && user?.id !== stream?.broadcaster_id && !privateAccessGranted) return;
    if (connectedRef.current) return;

    connectedRef.current = true;

    const connectRole = isBroadcaster ? 'host' : isGuestSeat ? 'guest' : 'audience';
    const allowPublish = isBroadcaster || isGuestSeat;

    const initSession = async () => {
      try {
        await liveKit.connect(streamId, user, {
          allowPublish,
          role: connectRole
        });

        if (isBroadcaster) {
          if (micRestrictionInfo.isMuted) {
            toast.error(micRestrictionInfo.message || 'Microphone is disabled.');
            setMicOn(false);
          } else {
            const micEnabled = await liveKit.enableMicrophone();
            const camEnabled = await liveKit.enableCamera();
            setMicOn(micEnabled);
            setCameraOn(camEnabled);
          }
        }

        const room = liveKit.getRoom();
        const localPubCount = room?.localParticipant?.videoTrackPublications.size ?? 0;
        const blurDetected = typeof window !== 'undefined'
          ? Boolean(document.querySelector('.tile-inner .blur-lg, .tile-inner .backdrop-blur-sm'))
          : false;

        console.log('ROLE', connectRole);
        console.log('PUB', localPubCount);
        console.log('BLUR', blurDetected);
      } catch (err) {
        console.error('Failed to connect to LiveKit:', err);
        toast.error('Failed to start broadcast session');
        connectedRef.current = false;
      }
    };

    initSession();

    return () => {
      connectedRef.current = false;
      liveKit.disconnect();
    };
  }, [streamId, user?.id, profile?.id, stream?.id, stream?.is_private, privateAccessGranted, liveKit]);

  // Track viewers for this stream
  useViewerTracking(streamId || '', user?.id || null);

  // Enable camera and mic for guests when they join a seat
  useEffect(() => {
    if (!isBroadcaster && seats.some(seat => seat?.user_id === user?.id)) {
      const enableGuestMedia = async () => {
        try {
          // Check if already publishing
          const currentRoom = liveKit.getRoom();
          const isAlreadyPublishing = currentRoom?.localParticipant?.videoTrackPublications.size > 0 ||
                                    currentRoom?.localParticipant?.audioTrackPublications.size > 0;
          
          if (!isAlreadyPublishing) {
            if (micRestrictionInfo.isMuted) {
              toast.error(micRestrictionInfo.message || 'Microphone is disabled.');
              setMicOn(false);
            } else {
              // Enable camera and mic for the guest without disconnecting
              // Use explicit enable calls instead of toggle to avoid turning off existing streams
              const micEnabled = await liveKit.enableMicrophone();
              const cameraEnabled = await liveKit.enableCamera();
              
              // Set local state to reflect media is on
              setMicOn(micEnabled);
              setCameraOn(cameraEnabled);
              
              // Debug: Log the media state after enabling
              console.log('Guest media enabled:', { micEnabled, cameraEnabled });
            }
          }
        } catch (err) {
          console.error('Failed to enable guest media:', err);
          toast.error('Failed to enable camera and mic');
        }
      };
      
      enableGuestMedia();
    }
  }, [isBroadcaster, seats, user, streamId, liveKit]);

  useEffect(() => {
    const occupantIds = currentOccupants
      .map((seat) => seat?.user_id)
      .filter(Boolean) as string[];
    const nextSet = new Set(occupantIds);

    if (!seatSyncRef.current) {
      prevSeatUsersRef.current = nextSet;
      seatSyncRef.current = true;
      return;
    }

    const newSeat = currentOccupants.find(
      (seat) => seat?.user_id && !prevSeatUsersRef.current.has(seat.user_id)
    );

    prevSeatUsersRef.current = nextSet;

    if (!newSeat) {
      return;
    }

    setEntranceEffect({
      username: newSeat.username,
      role: newSeat.role,
      profile: newSeat.metadata?.profile,
    });

    if (entranceTimerRef.current) {
      window.clearTimeout(entranceTimerRef.current);
    }
    entranceTimerRef.current = window.setTimeout(() => {
      setEntranceEffect(null);
      entranceTimerRef.current = null;
    }, 6000);
  }, [currentOccupants]);

  useEffect(() => {
    return () => {
      if (entranceTimerRef.current) {
        window.clearTimeout(entranceTimerRef.current);
        entranceTimerRef.current = null;
      }
    };
  }, []);

  // Handlers
  const toggleMic = async () => {
    if (!micOn && micRestrictionInfo.isMuted) {
      toast.error(micRestrictionInfo.message || 'Microphone is disabled.');
      return;
    }
    const newState = !micOn;
    setMicOn(newState);
    await liveKit.toggleMicrophone();
  };

  const toggleCamera = async () => {
    const newState = !cameraOn;
    setCameraOn(newState);
    await liveKit.toggleCamera();
  };

  // Gift Events
  const lastGift = useGiftEvents(streamId);
  const handleGiftSent = async (giftData: any) => {
    // Logic to record gift in Supabase handled by GiftModal or here
    // For now simple toast
    toast.success(`Sent ${giftData.quantity} ${giftData.name}!`);
    setIsGiftModalOpen(false);
  };

  // Invite Followers Function
  const handleInviteFollowers = async () => {
    try {
      if (!stream) {
        toast.error('Stream not loaded');
        return;
      }

      // Send notifications to broadcaster's followers
      const { data: followers, error: followersError } = await supabase
        .from('followers')
        .select('follower_id')
        .eq('user_id', stream.broadcaster_id);

      if (followersError) {
        console.error('Error fetching followers:', followersError);
        toast.error('Failed to fetch followers');
        return;
      }

      if (followers && followers.length > 0) {
        // Send notification to each follower
        const followerIds = followers.map(f => f.follower_id);
        const privateHint =
          stream.is_private && cachedPrivatePassword
            ? ` Password: ${cachedPrivatePassword}.`
            : '';

        // Insert notifications into the database
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(followerIds.map(followerId => ({
            user_id: followerId,
            type: 'stream_invite',
            title: 'Live Stream Invitation',
            message: `${profile?.username || 'A broadcaster'} has invited you to join their ${stream.is_private ? 'private ' : ''}live stream!${privateHint}`,
            metadata: {
              stream_id: streamId,
              broadcaster_id: stream.broadcaster_id,
              broadcaster_name: profile?.username || 'Broadcaster',
              private_stream: stream.is_private
            },
            is_read: false,
            created_at: new Date().toISOString()
          })));

        if (notificationError) {
          console.error('Error sending notifications:', notificationError);
          toast.error('Failed to send some invitations');
        } else {
          toast.success(`Invitations sent to ${followerIds.length} followers!`);
        }
      } else {
        toast.info('No followers to invite');
      }
    } catch (err) {
      console.error('Error inviting followers:', err);
      toast.error('Failed to invite followers');
    }
    };

  const handleCopyPrivatePassword = async () => {
    if (!cachedPrivatePassword) {
      toast.warning('No private password to copy');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast.error('Clipboard not available');
      return;
    }

    try {
      await navigator.clipboard.writeText(cachedPrivatePassword);
      toast.success('Private stream password copied');
    } catch (err) {
      console.error('Failed to copy password:', err);
      toast.error('Unable to copy password right now');
    }
  };

  // External Share Link Function
  const handleShareStream = async () => {
    try {
      if (!streamId) {
        toast.error('Stream ID not available');
        return;
      }

      // Generate shareable link
      const shareLink = `${window.location.origin}/stream/${streamId}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareLink);

      // Show success message
      toast.success('Stream link copied to clipboard!');

      // Also show a system share dialog if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: stream?.title || 'TrollCity Live Stream',
            text: `Join ${profile?.username || 'this broadcaster'}'s live stream on TrollCity!`,
            url: shareLink
          });
        } catch {
          // User canceled the share dialog, which is fine
          console.log('User canceled share dialog');
        }
      }
    } catch (err) {
      console.error('Error sharing stream:', err);
      toast.error('Failed to copy stream link');
    }
  };

  if (streamLoading || !stream) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p>Loading broadcast...</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col md:flex-row">
      {stream?.is_private && user?.id !== stream?.broadcaster_id && !privateAccessGranted && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0a16] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Private stream</h3>
            <p className="text-sm text-gray-300 mb-4">
              This broadcast is private. Enter the password provided by the broadcaster to join.
            </p>
            <input
              type="password"
              value={privatePasswordInput}
              onChange={(e) => setPrivatePasswordInput(e.target.value)}
              placeholder="Enter stream password"
              className="w-full bg-[#05060f] border border-purple-500/40 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none mb-2"
            />
            {privateAuthError && (
              <p className="text-xs text-red-400 mb-2">{privateAuthError}</p>
            )}
            <button
              className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 font-semibold text-sm"
              onClick={handlePrivatePasswordSubmit}
            >
              Submit password
            </button>
            {!user && (
              <p className="mt-3 text-xs text-gray-400">
                You must be logged in to use the password.
              </p>
            )}
          </div>
        </div>
      )}
      {stream?.is_private && isBroadcaster && cachedPrivatePassword && (
        <div className="absolute top-4 right-4 z-[220] w-full max-w-sm rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur-2xl shadow-lg shadow-black/70 text-sm text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs uppercase tracking-[0.4em] text-gray-400">Invite password</div>
            <button
              onClick={handleCopyPrivatePassword}
              className="text-xs text-purple-300 hover:text-purple-100"
            >
              Copy
            </button>
          </div>
          <div className="font-bold text-lg tracking-[0.12em] text-white/90 break-all mt-1">{cachedPrivatePassword}</div>
          <p className="text-[10px] text-gray-400 mt-1">Share this with invited viewers.</p>
        </div>
      )}
      {entranceEffect && <EntranceEffect username={entranceEffect.username} role={entranceEffect.role} profile={entranceEffect.profile} />}
      
      {/* Main Video Area */}
      <div className="flex-1 relative h-full md:h-auto overflow-hidden">
        <BroadcastLayout
          room={liveKit.getRoom()}
          broadcasterId={stream.broadcaster_id}
          isHost={isBroadcaster}
          seats={seats}
          joinPrice={joinPrice}
          lastGift={lastGift}
          onSetPrice={(newPrice) => {
            // Update the join price state
            setJoinPrice(newPrice);
            // This would be used to update the price in the database
            console.log('Join price updated:', newPrice);
          }}
          onJoinRequest={async (seatIndex: number) => {
           try {
             // Show seat cost popup if there's a price set
             if (joinPrice > 0) {
               setSeatCost(joinPrice);
               setSeatCostPopupVisible(true);
             }
              
             await claimSeat(seatIndex, { joinPrice });
           } catch (err) {
             console.error('Failed to claim seat:', err);
             toast.error('Failed to join seat');
           }
         }}
         onDisableGuestMedia={liveKit.disableGuestMediaByClick}
        >
          {/* Overlays */}
          <BroadcastOverlays
             title={stream.title}
             viewerCount={stream.current_viewers}
             isLive={stream.is_live}
             isBroadcaster={isBroadcaster}
             micOn={micOn}
             cameraOn={cameraOn}
             onToggleMic={toggleMic}
             onToggleCamera={toggleCamera}
             onOpenChat={() => setShowMobileChat(!showMobileChat)}
             onOpenGifts={() => setIsGiftModalOpen(true)}
             onOpenSettings={() => {}} // Placeholder
             onInviteFollowers={handleInviteFollowers}
             onShareStream={handleShareStream}
             totalCoins={stream.total_gifts_coins}
             startTime={stream.created_at}
          />
          
          {/* Gift Event Animation */}
          {lastGift && <GiftEventOverlay gift={lastGift} onProfileClick={setSelectedProfile} />}
        </BroadcastLayout>
      </div>

      {/* Right Panel (Desktop Chat) */}
      <div className="hidden md:flex w-80 border-l border-white/10 flex-col bg-[#0b091f]">
        <div className="shrink-0">
           <GiftBox onSendGift={handleGiftSent} />
        </div>
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-3">
          <div className="flex-1 min-h-0">
            <ChatBox
              streamId={streamId || ''}
              onProfileClick={setSelectedProfile}
              onCoinSend={() => setIsGiftModalOpen(true)}
              room={liveKit.getRoom()}
              isBroadcaster={isBroadcaster}
            />
          </div>
          <div className="space-y-4 overflow-y-auto max-h-[380px] pb-4">
            <BroadcastLayoutPreview />
            <ViewerLayoutPreview />
          </div>
        </div>
      </div>

      {/* Mobile Chat Sheet/Overlay */}
      {showMobileChat && (
        <div className="absolute inset-x-0 bottom-0 h-[65vh] bg-[#0b091f] rounded-t-2xl z-40 flex flex-col md:hidden animate-slideUp border-t border-white/10 shadow-2xl">
           <div className="flex justify-between items-center p-3 border-b border-white/5">
              <span className="font-bold text-sm">Live Chat</span>
              <button onClick={() => setShowMobileChat(false)} className="text-white/50 hover:text-white">Close</button>
           </div>
           <div className="flex-1 min-h-0">
             <ChatBox
               streamId={streamId || ''}
               onProfileClick={setSelectedProfile}
               onCoinSend={() => setIsGiftModalOpen(true)}
               room={liveKit.getRoom()}
               isBroadcaster={isBroadcaster}
             />
           </div>
        </div>
      )}

      {/* Modals */}
      <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="text-white">Loading...</div></div>}>
        {isGiftModalOpen && (
          <GiftModal
            onClose={() => setIsGiftModalOpen(false)}
            onSendGift={handleGiftSent}
            recipientName={giftRecipient?.username || 'Broadcaster'}
            profile={profile}
          />
        )}

        {selectedProfile && (
          <ProfileModal
            profile={selectedProfile}
            onClose={() => setSelectedProfile(null)}
            onSendCoins={() => {}}
            onGift={(p: UserProfile) => { setGiftRecipient(p); setIsGiftModalOpen(true); }}
            currentUser={user}
          />
        )}

        {isCoinStoreOpen && <CoinStoreModal onClose={() => setIsCoinStoreOpen(false)} onPurchase={() => {}} />}
      </Suspense>
      
      {/* Seat Cost Popup - shows when joining a seat with a price */}
      {seatCostPopupVisible && (
        <SeatCostPopup
          cost={seatCost}
          onClose={() => setSeatCostPopupVisible(false)}
          duration={10000}
        />
      )}
    </div>
  );
}
