import { useState, useRef, useCallback, useEffect } from 'react';

export function useMediaStream() {
  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);

  const startStream = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      setStream(mediaStream);
      setIsStreaming(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.muted = true; // Prevent feedback

        try {
          await videoRef.current.play();
        } catch (playErr) {
          if (playErr.name !== 'AbortError') {
            throw playErr;
          }
          // Ignore AbortError (interrupted by new load)
        }
      }

      return mediaStream;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  const attachToVideo = useCallback((videoElement) => {
    if (videoElement && stream) {
      videoElement.srcObject = stream;
      videoElement.muted = true;
      videoElement.play().catch(console.error);
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    stream,
    isStreaming,
    error,
    videoRef,
    startStream,
    stopStream,
    attachToVideo
  };
}