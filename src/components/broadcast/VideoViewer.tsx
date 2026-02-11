import { useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import React, { useRef, useEffect } from 'react';

export default function VideoViewer() {
  const videoTracks = useTracks([Track.Source.Camera]);
  const videoEl = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoEl.current && videoTracks.length > 0) {
      videoTracks[0].track?.attach(videoEl.current);
    }
  }, [videoTracks]);

  return <video ref={videoEl} width="100%" height="100%" />;
}
