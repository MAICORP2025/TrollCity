import React, { useEffect, useState, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'

import { Stream } from '../../types/broadcast'
import BroadcastGrid from '../../components/broadcast/BroadcastGrid'
import BroadcastChat from '../../components/broadcast/BroadcastChat'
import BroadcastControls from '../../components/broadcast/BroadcastControls'
import BroadcastHeader from '../../components/broadcast/BroadcastHeader'
import BattleView from '../../components/broadcast/BattleView'
import BattleControls from '../../components/broadcast/BattleControls'
import ErrorBoundary from '../../components/ErrorBoundary'
import GiftBoxModal from '../../components/broadcast/GiftBoxModal'
import GiftAnimationOverlay from '../../components/broadcast/GiftAnimationOverlay'
import PinnedProductOverlay from '../../components/broadcast/PinnedProductOverlay'
import PinProductModal from '../../components/broadcast/PinProductModal'
import { BroadcastGift } from '../../hooks/useBroadcastRealtime'
import { useBroadcastPinnedProducts } from '../../hooks/useBroadcastPinnedProducts'

import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useStreamSeats } from '../../hooks/useStreamSeats'

import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser
} from 'agora-rtc-sdk-ng'

function BroadcastPage() {
  /** ROUTER PARAM FIX */
  const params = useParams()
  const streamId = params.id || params.streamId

  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [stream, setStream] = useState<Stream | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [localTracks, setLocalTracks] =
    useState<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null)

  const [remoteUsers, setRemoteUsers] =
    useState<IAgoraRTCRemoteUser[]>([])

  const [muxPlaybackId, setMuxPlaybackId] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(true)
  const [isBattleMode, setIsBattleMode] = useState(false)
  
  // Gift system state
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
  const [recentGifts, setRecentGifts] = useState<BroadcastGift[]>([])

  // Pin product modal state
  const [isPinProductModalOpen, setIsPinProductModalOpen] = useState(false)

  // Determine host status early (needed for pinned products hook)
  const isHost = stream?.user_id === user?.id

  // Pinned products hook
  const { pinnedProducts, pinProduct } = useBroadcastPinnedProducts({
    streamId: streamId || '',
    userId: user?.id,
    isHost,
  })

  const agoraClientRef = useRef<IAgoraRTCClient | null>(null)

  /** STREAM SEATS */
  const { seats, mySession: userSeat, joinSeat, leaveSeat } =
    useStreamSeats(stream?.id, user?.id)

  const canPublish = isHost || !!userSeat
  const mode = userSeat ? 'stage' : 'viewer'

  /** FETCH STREAM */
  useEffect(() => {
    if (!streamId) {
      setError('No stream ID provided.')
      setIsLoading(false)
      return
    }

    const fetchStream = async () => {
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle()

      if (error || !data) {
        setError('Stream not found.')
        toast.error('Stream not found.')
        navigate('/')
        return
      }

      setStream(data)

      if (data.status === 'ended') {
        navigate(`/summary/${streamId}`)
      }

      setIsLoading(false)
    }

    fetchStream()
  }, [streamId, navigate])

  /** REALTIME STREAM UPDATES */
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase.channel(`stream:${streamId}`);

    const streamSubscription = channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'streams',
          filter: `id=eq.${streamId}`
        },
        (payload) => {
          if (!payload.new) return;
          setStream(payload.new as Stream);
          // Navigate to home when stream ends - for ALL clients
          if (payload.new.status === 'ended') {
            console.log('[BroadcastPage] Stream ended, navigating to home');
            navigate('/');
          }
        }
      )
      // Listen for gift events
      .on(
        'broadcast',
        { event: 'gift_sent' },
        (payload) => {
          const giftData = payload.payload;
          console.log('[BroadcastPage] Gift received:', giftData);
          
          const newGift: BroadcastGift = {
            id: giftData.id || `gift-${Date.now()}`,
            gift_id: giftData.gift_id,
            gift_name: giftData.gift_name,
            gift_icon: giftData.gift_icon || '🎁',
            amount: giftData.amount,
            sender_id: giftData.sender_id,
            sender_name: giftData.sender_name || 'Someone',
            receiver_id: giftData.receiver_id,
            created_at: giftData.timestamp || new Date().toISOString(),
          };
          
          setRecentGifts(prev => [...prev, newGift]);
        }
      )
      // Listen for like events
      .on(
        'broadcast',
        { event: 'like_sent' },
        (payload) => {
          console.log('[BroadcastPage] Like received:', payload.payload);
          // Trigger a UI update for likes - the stream subscription will handle the actual count
          setStream((prev: any) => prev ? { ...prev, total_likes: (prev.total_likes || 0) + 1 } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, navigate]);

  /** AGORA INIT */
  useEffect(() => {
    if (!stream || !user) return

    let mounted = true

    const initAgora = async () => {
      const client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      })

      agoraClientRef.current = client

      client.on('user-published', async (remoteUser, mediaType) => {
        await client.subscribe(remoteUser, mediaType)

        if (!mounted) return

        setRemoteUsers(prev => {
          const filtered = prev.filter(u => u.uid !== remoteUser.uid)
          return [...filtered, remoteUser]
        })

        if (mediaType === 'audio') {
          remoteUser.audioTrack?.play()
        }
      })

      client.on('user-unpublished', remoteUser => {
        setRemoteUsers(prev =>
          prev.filter(u => u.uid !== remoteUser.uid)
        )
      })

      /** HOST OR GUEST → AGORA */
      if (canPublish) {
        setIsJoining(true)

        try {
          const { data, error } =
            await supabase.functions.invoke('agora-token', {
              body: {
                channelName: stream.id,
                userId: user.id
              }
            })

          if (error) throw error

          await client.join(
            import.meta.env.VITE_AGORA_APP_ID!,
            stream.id,
            data.token,
            user.id
          )

          const tracks =
            await AgoraRTC.createMicrophoneAndCameraTracks()

          if (!mounted) return

          setLocalTracks(tracks)

          await client.publish(tracks)

        } catch (err) {
          console.error(err)
          toast.error('Failed to join broadcast.')
        } finally {
          setIsJoining(false)
        }
      }
      /** VIEWER → MUX */
      else {
        if (stream.mux_playback_id) {
          setMuxPlaybackId(stream.mux_playback_id)
        }
      }
    }

    initAgora()

    return () => {
      mounted = false

      const client = agoraClientRef.current

      if (client) {
        client.leave()
      }

      if (localTracks) {
        localTracks[0].close()
        localTracks[1].close()
      }

      agoraClientRef.current = null
      setRemoteUsers([])
      setLocalTracks(null)
      setMuxPlaybackId(null)
    }
  }, [stream, user, canPublish])

  /** CAMERA / MIC */
  const toggleCamera = async () => {
    if (!localTracks) return
    await localTracks[1].setEnabled(!localTracks[1].enabled)
  }

  const toggleMicrophone = async () => {
    if (!localTracks) return
    await localTracks[0].setEnabled(!localTracks[0].enabled)
  }

  const onGift = (userId: string) => {
    setIsGiftModalOpen(true);
  }

  const onGiftAll = (ids: string[]) => {
    toast.info(`Gift sent to ${ids.length} users`)
  }

  const handleBoxCountChange = async (newCount: number) => {
    if (!stream) return;
    const { error } = await supabase
      .from('streams')
      .update({ box_count: newCount })
      .eq('id', stream.id);

    if (error) {
      toast.error('Failed to update box count.');
      console.error(error);
    }
  };

  const handleLike = async () => {
    if (!user) {
      navigate('/auth?mode=signup');
      return;
    }
    if (isHost) {
        toast.error("Broadcasters cannot like their own broadcast");
        return;
    }

    try {
        // Try to insert into stream_likes if table exists
        const { error } = await supabase.from('stream_likes').insert({
            stream_id: stream.id,
            user_id: user.id
        });

        if (error) {
            // If duplicate like (unique constraint), maybe just ignore or toggle?
            // Assuming we just want to count likes, we might ignore unique constraint errors
            if (error.code !== '23505') { // 23505 is unique violation
                console.error("Like error:", error);
            }
        }
    } catch (e) {
        console.error(e);
    }
  };

  /** LOADING */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-4">Joining stream...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
        <p className="text-red-500">{error}</p>
        <Link to="/">Go Home</Link>
      </div>
    )
  }

  if (!stream) return null

  if (stream.is_battle) {
    return (
      <BattleView
        battleId={stream.battle_id}
        currentStreamId={stream.id}
      />
    )
  }

  if (isJoining) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-black flex flex-col text-white">

        <BroadcastHeader
          stream={stream}
          isHost={isHost}
          liveViewerCount={remoteUsers.length}
          handleLike={handleLike}
        />

        <div className="flex flex-1 overflow-hidden">

          <div className="flex-1 flex flex-col">

            {mode === 'viewer' && muxPlaybackId ? (
              <mux-player
                playback-id={muxPlaybackId}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <BroadcastGrid
                stream={stream}
                seats={seats}
                onJoinSeat={(index) =>
                  joinSeat(index, stream.seat_price)
                }
                isHost={isHost}
                localTracks={
                  localTracks
                    ? [localTracks[1], localTracks[0]]
                    : [undefined, undefined]
                }
                remoteUsers={remoteUsers}
                localUserId={user?.id}
                onGift={onGift}
                onGiftAll={onGiftAll}
                toggleCamera={toggleCamera}
                toggleMicrophone={toggleMicrophone}
            />
          )}

          {isBattleMode && <BattleControls currentStream={stream} />}

            <BroadcastControls
              stream={stream}
              isHost={isHost}
              isOnStage={!!userSeat}
              chatOpen={isChatOpen}
              toggleChat={() => setIsChatOpen(!isChatOpen)}
              onGiftHost={() => onGift(stream.user_id)}
              onLeave={leaveSeat}
              onBoxCountUpdate={handleBoxCountChange}
              handleLike={handleLike}
              toggleBattleMode={() => setIsBattleMode(!isBattleMode)}
              localTracks={localTracks}
              toggleCamera={toggleCamera}
              toggleMicrophone={toggleMicrophone}
              onPinProduct={() => setIsPinProductModalOpen(true)}
            />
          </div>

          <BroadcastChat
            streamId={streamId!}
            hostId={stream.user_id}
            isHost={isHost}
            isViewer={!userSeat}
          />

        </div>
      </div>

      {/* Gift Modal */}
      <GiftBoxModal
        isOpen={isGiftModalOpen}
        onClose={() => setIsGiftModalOpen(false)}
        recipientId={stream?.user_id || ''}
        streamId={streamId || ''}
        onGiftSent={(gift) => {
          console.log('Gift sent:', gift);
        }}
      />

      {/* Gift Animation Overlay */}
      <GiftAnimationOverlay
        gifts={recentGifts}
        onAnimationComplete={(giftId) => {
          setRecentGifts(prev => prev.filter(g => g.id !== giftId));
        }}
      />

      {/* Pinned Product Overlay (for viewers) */}
      {!isHost && pinnedProducts.length > 0 && (
        <PinnedProductOverlay
          pinnedProducts={pinnedProducts}
        />
      )}

      {/* Pin Product Modal (for host) */}
      <PinProductModal
        isOpen={isPinProductModalOpen}
        onClose={() => setIsPinProductModalOpen(false)}
        onProductPinned={async (productId) => {
          const result = await pinProduct(productId);
          if (result.success) {
            // Product pinned successfully
          } else {
            // Handle error
          }
        }}
      />
    </ErrorBoundary>
  )
}

export default BroadcastPage