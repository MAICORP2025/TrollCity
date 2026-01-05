import {
  Room,
  RoomEvent,
  createLocalVideoTrack,
  createLocalAudioTrack,
  Track,
  TrackPublication,
  Participant,
} from 'livekit-client'
import { useEffect, useRef } from 'react'

interface VideoFeedProps {
  room: Room | null
  isHost?: boolean
}

export default function VideoFeed({ room, isHost = false }: VideoFeedProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!room) return

    /* ===============================
       HOST: HANDLE LOCAL TRACKS
    =============================== */
    const handleLocalTrackPublished = (
      publication: TrackPublication,
      participant: Participant
    ) => {
      if (!isHost || !localVideoRef.current) return
      
      if (publication.kind === 'video' && publication.track) {
        console.log('[VideoFeed] Attaching local video track')
        publication.track.attach(localVideoRef.current)
        localVideoRef.current.muted = true
        localVideoRef.current.playsInline = true
        localVideoRef.current.play().catch(console.error)
      }
    }

    // 1. Check if tracks are ALREADY published (e.g. by useLiveKitSession)
    if (isHost && room.localParticipant) {
       const videoTrackPub = Array.from(room.localParticipant.videoTrackPublications.values())[0];
       if (videoTrackPub && videoTrackPub.track && localVideoRef.current) {
          console.log('[VideoFeed] Found existing local video track, attaching...')
          videoTrackPub.track.attach(localVideoRef.current);
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true;
          localVideoRef.current.play().catch(() => {});
       }
    }

    // 2. Listen for future track publishing
    if (isHost) {
      room.on(RoomEvent.LocalTrackPublished, handleLocalTrackPublished)
      
      // Force check again after a short delay to catch race conditions
      setTimeout(() => {
        if (room.localParticipant) {
           const videoTrackPub = Array.from(room.localParticipant.videoTrackPublications.values())[0];
           if (videoTrackPub && videoTrackPub.track && localVideoRef.current) {
              videoTrackPub.track.attach(localVideoRef.current);
              localVideoRef.current.play().catch(() => {});
           }
        }
      }, 1000);
    }

    /* ===============================
       REMOTE TRACK HANDLING
    =============================== */
    const handleTrackSubscribed = (
      track: Track,
      _publication: TrackPublication,
      participant: Participant
    ) => {
      if (!remoteContainerRef.current) return
      if (participant.isLocal) return

      if (track.kind === Track.Kind.Video) {
        const el = track.attach()
        el.className = 'w-full h-full object-cover rounded-3xl'
        remoteContainerRef.current.appendChild(el)
      }

      if (track.kind === Track.Kind.Audio) {
        const el = track.attach()
        remoteContainerRef.current.appendChild(el)
      }
    }

    const handleTrackUnsubscribed = (track: Track) => {
      track.detach()
    }

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)

    // Handle existing remote tracks (in case we joined before mounting or missed events)
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        if (publication.track && publication.isSubscribed) {
          handleTrackSubscribed(publication.track, publication, participant)
        }
      })
    })

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
    }
  }, [room, isHost])

  return (
    <div className="absolute inset-0 rounded-3xl overflow-hidden bg-black">
      {isHost && (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-10 scale-x-[-1]"
          style={{ transform: 'scaleX(-1)' }}
        />
      )}

      <div
        ref={remoteContainerRef}
        className="absolute inset-0 w-full h-full z-0"
      />
    </div>
  )
}
