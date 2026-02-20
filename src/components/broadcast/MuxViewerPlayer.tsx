import MuxVideo from '@mux/mux-video-react';
import MuxAudio from '@mux/mux-audio-react';
import React from 'react';

interface MuxViewerPlayerProps {
  playbackId: string;
  streamType?: 'on-demand' | 'live' | 'll-live'; // 'live' for HLS, 'll-live' for Low Latency HLS
  autoPlay?: boolean;
  muted?: boolean;
  isAudioOnly?: boolean;
  // Add any other props you might need for styling or Mux metadata
  // For example, to pass through to MuxVideo/MuxAudio components:
  // metadata?: {
  //   video_id?: string;
  //   video_title?: string;
  //   viewer_user_id?: string;
  // };
}

const MuxViewerPlayer: React.FC<MuxViewerPlayerProps> = ({
  playbackId,
  streamType = 'live',
  autoPlay = true,
  muted = true,
  isAudioOnly = false,
}) => {
  if (!playbackId) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black text-white/50">
        No playback ID available.
      </div>
    );
  }

  // MuxVideo and MuxAudio components automatically handle the src URL construction
  // from the playbackId.
  return (
    <div className="relative w-full h-full bg-black">
      {isAudioOnly ? (
        <MuxAudio
          playbackId={playbackId}
          streamType={streamType}
          autoPlay={autoPlay}
          muted={muted}
          controls={false} // Typically no controls for background audio
          className="absolute inset-0 w-full h-full object-contain"
        />
      ) : (
        <MuxVideo
          playbackId={playbackId}
          streamType={streamType}
          autoPlay={autoPlay}
          muted={muted}
          controls
          // The poster image could be added here if available
          // poster={`https://image.mux.com/${playbackId}/thumbnail.jpg?time=0`}
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}
    </div>
  );
};

export default MuxViewerPlayer;
