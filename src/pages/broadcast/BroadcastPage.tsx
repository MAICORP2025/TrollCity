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
import ErrorBoundary from '../../components/ErrorBoundary'

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

  const agoraClientRef = useRef<IAgoraRTCClient | null>(null)

  /** STREAM SEATS */
  const { seats, mySession: userSeat, joinSeat, leaveSeat } =
    useStreamSeats(stream?.id, user?.id)

  const isHost = stream?.user_id === user?.id
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
        .single()

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
          setStream(payload.new as Stream);
          if (payload.new.status === 'ended') {
            navigate(`/summary/${streamId}`);
          }
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
            process.env.NEXT_PUBLIC_AGORA_APP_ID!,
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
    toast.info(`Gift sent to ${userId}`)
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

            <BroadcastControls
              stream={stream}
              isHost={isHost}
              isOnStage={!!userSeat}
              chatOpen={isChatOpen}
              toggleChat={() => setIsChatOpen(!isChatOpen)}
              onGiftHost={() => onGift(stream.user_id)}
              onLeave={leaveSeat}
              onBoxCountUpdate={handleBoxCountChange}
              localTracks={localTracks}
              toggleCamera={toggleCamera}
              toggleMicrophone={toggleMicrophone}
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
    </ErrorBoundary>
  )
}

export default BroadcastPage