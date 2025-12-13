import {
  Room,
  RoomEvent,
  createLocalVideoTrack,
  createLocalAudioTrack,
  Track,
  TrackPublication,
  RemoteParticipant,
  LocalParticipant,
  Participant,
} from 'livekit-client';
import { useEffect, useRef } from 'react';

interface VideoFeedProps {
  room: Room | null;
  isHost?: boolean;
}

export default function VideoFeed({ room, isHost = false }: VideoFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!room) return;

    // If host, publish local tracks
    if (isHost) {
      const publishLocalTracks = async () => {
        try {
          // ✅ Permission gate (prevents "insufficient permissions" publish errors)
          // LiveKit permissions are enforced by token grants. UI flags cannot override token grants.
          const canPublish =
            // Some SDK versions expose permissions here
            (room.localParticipant as any)?.permissions?.canPublish === true ||
            // Some setups store it on participant info
            (room.localParticipant as any)?.participantInfo?.permissions?.canPublish === true;

          if (!canPublish) {
            console.warn(
              '[LiveKit] Host attempted to publish, but token has canPublish=false. Skipping publishLocalTracks().'
            );
            return;
          }

          // ✅ Duplicate publish guard (prevents publishing twice)
          const alreadyPublishing =
            room.localParticipant.videoTrackPublications.size > 0 ||
            room.localParticipant.audioTrackPublications.size > 0;

          if (alreadyPublishing) return;

          const [videoTrack, audioTrack] = await Promise.all([
            createLocalVideoTrack(),
            createLocalAudioTrack(),
          ]);

          await room.localParticipant.publishTrack(videoTrack);
          await room.localParticipant.publishTrack(audioTrack);

          // Attach video to preview
          if (videoRef.current) {
            videoTrack.attach(videoRef.current);
            videoRef.current.muted = true;

            // Some browsers will throw if play() isn't allowed yet; ignore safely
            try {
              await videoRef.current.play();
            } catch (e) {
              console.warn('[LiveKit] videoRef.play() blocked by browser policy:', e);
            }
          }
        } catch (error) {
          console.error('Failed to publish local tracks:', error);
        }
      };

      publishLocalTracks();
    }

    // Handle remote tracks
    const handleTrackSubscribed = (
      track: Track,
      publication: TrackPublication,
      participant: Participant
    ) => {
      if (track.kind === Track.Kind.Video) {
        if (participant.isLocal && videoRef.current) {
          // Local video already attached above
        } else if (!participant.isLocal) {
          // Remote video - attach to parent container
          const element = track.attach();
          if (videoRef.current?.parentElement) {
            const container = videoRef.current.parentElement;

            // Clear existing remote videos
            const existingRemote = container.querySelector('.remote-video-container');
            if (existingRemote) {
              existingRemote.remove();
            }

            // Create container for remote video
            const remoteContainer = document.createElement('div');
            remoteContainer.className = 'remote-video-container absolute inset-0 w-full h-full';

            remoteContainer.appendChild(element);
            container.appendChild(remoteContainer);
          }
        }
      } else if (track.kind === Track.Kind.Audio) {
        track.attach();
      }
    };

    const handleTrackUnsubscribed = (track: Track) => {
      track.detach();
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);

    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    };
  }, [room, isHost]);

  return (
    <div className="absolute inset-0 rounded-3xl overflow-hidden">
      {isHost && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      )}
      {!isHost && (
        <div className="w-full h-full bg-black">
          {/* Remote videos will be attached here via TrackSubscribed event */}
        </div>
      )}
    </div>
  );
}
