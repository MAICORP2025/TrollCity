import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Radio, Users, Eye, Gift, Send, Skull, ShieldOff, Crown, Star,
  MessageSquare
} from 'lucide-react'
import { supabase, Stream, UserProfile } from '../lib/supabase'
import api from '../lib/api'
import { useAuthStore } from '../lib/store'
import { toast } from 'sonner'
import ClickableUsername from '../components/ClickableUsername'
import TrollEvent from '../components/TrollEvent'

const StreamRoom = () => {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuthStore()

  const livekitUrl = location.state?.serverUrl
  const livekitToken = location.state?.token
  const isHost = location.state?.isHost || false

  const remoteVideoRef = useRef<HTMLDivElement>(null)
  const client = useRef<any>(null)

  const [stream, setStream] = useState<Stream | null>(null)
  const [broadcaster, setBroadcaster] = useState<UserProfile | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [joining, setJoining] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isEndingStream, setIsEndingStream] = useState(false)

  /** ────────────────────────────────────────────────
   📡 Initialize LiveKit - Handles BOTH host & viewer
  ───────────────────────────────────────────────────*/
  const initializeLiveKit = async () => {
    if (!livekitUrl || !livekitToken) {
      console.warn('Missing LiveKit credentials')
      return
    }

    try {
      const { Room, RoomEvent, createLocalTracks } = await import('livekit-client')

      // 1. Create Room client
      client.current = new Room({
        adaptiveStream: true,
        dynacast: true,
      })

      // 2. Set track subscription handlers BEFORE connecting
      client.current.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        if (track.kind === 'video') {
          const el = track.attach()
          if (remoteVideoRef.current) {
            remoteVideoRef.current.innerHTML = ''
            remoteVideoRef.current.appendChild(el)
          }
        } else if (track.kind === 'audio') {
          track.attach()
        }
      })

      client.current.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach()
      })

      // 3. Connect viewer or host
      await client.current.connect(livekitUrl, livekitToken)

      // 4. If host, publish local mic/camera tracks
      if (isHost) {
        const tracks = await createLocalTracks({ audio: true, video: true })
        for (const track of tracks) {
          await client.current.localParticipant.publishTrack(track)
        }
      }

      console.log('LiveKit connected', isHost ? 'as Host' : 'as Viewer')
    } catch (err) {
      console.error('LiveKit init failed:', err)
      toast.error('Failed to connect to LiveKit')
    }
  }

  /** ────────────────────────────────────────────────
   🌐 Load Stream Data
  ───────────────────────────────────────────────────*/
  useEffect(() => {
    loadStreamData()
  }, [streamId])

  const loadStreamData = async () => {
    try {
      const { data: s } = await supabase
        .from('troll_streams')
        .select('*')
        .eq('id', streamId)
        .single()

      if (!s) {
        toast.error('Stream not found')
        return navigate('/')
      }

      setStream(s)

      const { data: bc } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', s.broadcaster_id)
        .single()

      setBroadcaster(bc || null)
      setLoading(false)
    } catch {
      toast.error('Failed to load stream')
      setLoading(false)
    }
  }

  /** ────────────────────────────────────────────────
   🚪 Join LiveKit when stream & user ready
  ───────────────────────────────────────────────────*/
  useEffect(() => {
    if (stream && user) {
      joinStream()
      initializeLiveKit()
    }

    return () => {
      try { client.current?.disconnect() } catch {}
    }
  }, [stream, user])

  const joinStream = async () => {
    try {
      setJoining(true)
      await supabase
        .from('troll_streams')
        .update({ current_viewers: (stream?.current_viewers || 0) + 1 })
        .eq('id', streamId)
    } catch {}
    finally {
      setJoining(false)
    }
  }

  /** ────────────────────────────────────────────────
   🛑 End Stream (Broadcaster)
  ───────────────────────────────────────────────────*/
  const endStreamAsBroadcaster = async () => {
    if (!stream || profile?.id !== stream.broadcaster_id) return

    try {
      setIsEndingStream(true)
      await supabase
        .from('troll_streams')
        .update({
          is_live: false,
          status: 'ended',
          end_time: new Date().toISOString()
        })
        .eq('id', stream.id)

      toast.success('Stream ended')
      navigate('/stream-ended')
    } catch {
      toast.error('Failed to end stream')
    } finally {
      setIsEndingStream(false)
    }
  }

  /** ────────────────────────────────────────────────
   📸 UI Rendering
  ───────────────────────────────────────────────────*/
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading stream...
      </div>
    )
  }

  if (!stream || !broadcaster) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        Stream not found
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto p-4">

        {/* Video Streaming Area */}
        <div className="bg-gray-900 rounded-xl overflow-hidden border border-purple-500 shadow-lg">
          <div className="relative aspect-video">
            <div ref={remoteVideoRef} className="w-full h-full bg-black"></div>

            {joining && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <Radio className="w-12 h-12 text-purple-400 animate-pulse" />
                <p className="mt-2 text-sm">Connecting to live stream...</p>
              </div>
            )}
          </div>
        </div>

        {/* Stream Info + Controls */}
        <div className="mt-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{stream.title}</h2>

          {isHost && (
            <button
              onClick={endStreamAsBroadcaster}
              className="px-4 py-2 bg-red-600 text-white rounded-lg"
              disabled={isEndingStream}
            >
              {isEndingStream ? 'Ending...' : 'End Stream'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default StreamRoom
