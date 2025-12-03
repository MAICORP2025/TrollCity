import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { Video } from 'lucide-react';
import BroadcasterApplicationForm from '../components/BroadcasterApplicationForm';
import { toast } from 'sonner';

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  const { user, profile } = useAuthStore();

  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [isTestingMode, setIsTestingMode] = useState(false);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const [broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean;
    hasApplication: boolean;
    applicationStatus: string | null;
  } | null>(null);

  // -------------------------------
  // CHECK BROADCASTER STATUS
  // -------------------------------
  useEffect(() => {
    const checkStatus = async () => {
      const { user, profile } = useAuthStore.getState();
      if (!user || !profile) return;

      // If already marked broadcaster
      if (profile.is_broadcaster) {
        setBroadcasterStatus({
          isApproved: true,
          hasApplication: true,
          applicationStatus: 'approved',
        });
        return;
      }

      // Check broadcaster_applications table
      const { data } = await supabase
        .from('broadcaster_applications')
        .select('application_status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        setBroadcasterStatus({
          isApproved: false,
          hasApplication: false,
          applicationStatus: null,
        });
      } else {
        setBroadcasterStatus({
          isApproved: data.application_status === 'approved',
          hasApplication: true,
          applicationStatus: data.application_status,
        });
      }
    };

    checkStatus();
  }, []);

  // -------------------------------
  // START STREAM
  // -------------------------------
  const handleStartStream = async () => {
    const { profile, user } = useAuthStore.getState();

    if (!user || !profile) {
      toast.error('You must be logged in.');
      return;
    }

    if (!profile.is_broadcaster && !isTestingMode) {
      toast.error('🚫 You must be an approved broadcaster to go live.');
      return;
    }

    if (!streamTitle.trim()) {
      toast.error('Enter a stream title.');
      return;
    }

    setIsConnecting(true);

    try {
      const streamId = crypto.randomUUID();
      let thumbnailUrl = null;

      // Upload thumbnail
      if (thumbnailFile) {
        setUploadingThumbnail(true);

        const fileName = `thumb-${streamId}-${Date.now()}.${thumbnailFile.name.split('.').pop()}`;
        const filePath = `thumbnails/${fileName}`;

        const upload = await supabase.storage
          .from('troll-city-assets')
          .upload(filePath, thumbnailFile, { upsert: false });

        if (!upload.error) {
          const { data: url } = supabase.storage
            .from('troll-city-assets')
            .getPublicUrl(filePath);

          thumbnailUrl = url.publicUrl;
        }

        setUploadingThumbnail(false);
      }

      // Insert into streams table
      const { error: insertError } = await supabase.from('streams').insert({
        id: streamId,
        broadcaster_id: profile.id,
        title: streamTitle,
        room_name: streamId,
        is_live: true,
        status: 'live',
        start_time: new Date().toISOString(),
        thumbnail_url: thumbnailUrl,
        is_testing_mode: isTestingMode,
        viewer_count: 0,
        current_viewers: 0,
        total_gifts_coins: 0,
        popularity: 0,
      });

      if (insertError) {
        console.error(insertError);
        toast.error('Failed to start stream.');
        return;
      }

      // LiveKit token
      const tokenResponse = await api.post('/livekit-token', {
        room: streamId,
        identity: user.email || user.id,
        isHost: true,
      });

      const serverUrl = tokenResponse.serverUrl || tokenResponse.livekitUrl;
      const token =
        tokenResponse.token ||
        tokenResponse?.token?.token ||
        tokenResponse?.accessToken ||
        null;

      if (!token || !serverUrl) {
        toast.error('LiveKit token error.');
        return;
      }

      setIsStreaming(true);

      navigate(`/stream/${streamId}`, {
        state: {
          roomName: streamId,
          serverUrl,
          token,
          streamTitle,
          isHost: true,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error('Error starting stream.');
    }

    setIsConnecting(false);
  };

  // -------------------------------
  // Camera preview
  // -------------------------------
  useEffect(() => {
    let previewStream: MediaStream | null = null;

    if (videoRef.current && !isStreaming) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
        previewStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }).catch((err) => {
        console.error('Error accessing camera/microphone:', err);
      });
    }

    // Cleanup: Stop all tracks when component unmounts or when streaming starts
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach(track => {
          track.stop();
        });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [isStreaming]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 go-live-wrapper">
      <BroadcasterApplicationForm
        isOpen={showApplicationForm}
        onClose={() => setShowApplicationForm(false)}
        onSubmitted={() => toast.success('Application submitted')}
      />

      <h1 className="text-3xl font-extrabold flex items-center gap-2">
        <Video className="text-troll-gold w-8 h-8" />
        Go Live
      </h1>

      <div className="host-video-box relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {!isStreaming && (
          <div className="absolute inset-0 bg-black/50 flex justify-center items-center text-white">
            Camera Preview
          </div>
        )}
      </div>

      {!isStreaming ? (
        <div className="bg-[#0E0A1A] border border-purple-700/40 p-6 rounded-xl space-y-6">
          <div>
            <label className="text-gray-300">Stream Title *</label>
            <input
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              className="w-full bg-[#171427] border border-purple-500/40 text-white rounded-lg px-4 py-3"
            />
          </div>

          <button
            onClick={handleStartStream}
            disabled={isConnecting}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-semibold"
          >
            {isConnecting ? 'Starting…' : 'Go Live'}
          </button>
        </div>
      ) : (
        <div className="p-6 text-gray-300">Redirecting to stream…</div>
      )}
    </div>
  );
};

export default GoLive;
