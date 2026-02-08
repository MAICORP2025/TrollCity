import { useEffect, useRef, useState } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track, RoomEvent, ConnectionState } from 'livekit-client';

interface PreflightPublisherProps {
    stream: MediaStream;
    onPublished?: () => void;
}

export default function PreflightPublisher({ stream, onPublished }: PreflightPublisherProps) {
    const { localParticipant } = useLocalParticipant();
    const room = useRoomContext();
    const hasPublished = useRef(false);
    const [isRoomReady, setIsRoomReady] = useState(false);

    // Monitor room connection state
    useEffect(() => {
        if (!room) return;
        
        const checkState = () => {
            if (room.state === ConnectionState.Connected) {
                setIsRoomReady(true);
            } else {
                setIsRoomReady(false);
            }
        };

        checkState();
        
        room.on(RoomEvent.Connected, checkState);
        room.on(RoomEvent.Reconnected, checkState);
        room.on(RoomEvent.Disconnected, checkState);

        return () => {
            room.off(RoomEvent.Connected, checkState);
            room.off(RoomEvent.Reconnected, checkState);
            room.off(RoomEvent.Disconnected, checkState);
        };
    }, [room]);

    useEffect(() => {
        if (!localParticipant || hasPublished.current || !stream || !isRoomReady) return;

        // Check permissions - these are available on localParticipant
        if (!localParticipant.permissions) {
            console.log('[PreflightPublisher] Waiting for permissions object...');
            return;
        }

        if (!localParticipant.permissions.canPublish) {
            console.error('[PreflightPublisher] Permissions loaded but canPublish is FALSE', localParticipant.permissions);
            return;
        }

        const publish = async (retryCount = 0) => {
            console.log('[PreflightPublisher] Publishing preflight stream tracks...', {
                permissions: localParticipant.permissions,
                identity: localParticipant.identity,
                retryCount
            });

            try {
                const videoTrack = stream.getVideoTracks()[0];
                const audioTrack = stream.getAudioTracks()[0];

                // Check if tracks are still active
                if (videoTrack && videoTrack.readyState === 'ended') {
                    console.warn('[PreflightPublisher] Video track is ended');
                }
                if (audioTrack && audioTrack.readyState === 'ended') {
                    console.warn('[PreflightPublisher] Audio track is ended');
                }

                if (videoTrack && videoTrack.readyState === 'live') {
                    // Force enable track to ensure it starts ON as requested
                    videoTrack.enabled = true;
                    await localParticipant.publishTrack(videoTrack, { 
                        name: 'camera',
                        source: Track.Source.Camera 
                    });
                }
                if (audioTrack && audioTrack.readyState === 'live') {
                    // Force enable track to ensure it starts ON as requested
                    audioTrack.enabled = true;
                    await localParticipant.publishTrack(audioTrack, { 
                        name: 'microphone',
                        source: Track.Source.Microphone 
                    });
                }
                
                hasPublished.current = true;
                if (onPublished) onPublished();
                
                console.log('[PreflightPublisher] Successfully published tracks');
            } catch (error: any) {
                console.error('[PreflightPublisher] Error publishing tracks:', error);
                
                // Retry on timeout or connection error if we haven't exceeded limit
                if (retryCount < 3 && (error.message?.includes('timeout') || error.message?.includes('ConnectionError'))) {
                    console.log(`[PreflightPublisher] Retrying publication in 2s (Attempt ${retryCount + 1}/3)...`);
                    setTimeout(() => publish(retryCount + 1), 2000);
                }
            }
        };

        // Small delay to ensure SFU is ready even if connected
        const timer = setTimeout(() => {
            publish();
        }, 500);

        return () => clearTimeout(timer);
    }, [
        localParticipant, 
        stream, 
        onPublished,
        localParticipant?.permissions,
        isRoomReady
    ]);

    return null;
}
