import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// import api from '../lib/api'; // Uncomment if needed
import { supabase } from '../supabaseClient';
import { useAuthStore } from '../lib/store';
import { Video, Camera, Mic, MicOff, CameraOff } from 'lucide-react';
import { toast } from 'sonner';

const GoLive: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  // const { user, profile } = useAuthStore(); // Using getState() instead for async operations

  const [streamTitle, setStreamTitle] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [_uploadingThumbnail, setUploadingThumbnail] = useState(false); // Thumbnail upload state
  const [broadcasterName, setBroadcasterName] = useState<string>('');
  const [category, setCategory] = useState<string>('Chat');
  const [isPrivateStream, setIsPrivateStream] = useState<boolean>(false);
  const [enablePaidGuestBoxes, setEnablePaidGuestBoxes] = useState<boolean>(false);

  // Camera preview state
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [isMicOn, setIsMicOn] = useState<boolean>(true);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);



  const [_broadcasterStatus, setBroadcasterStatus] = useState<{
    isApproved: boolean;
    hasApplication: boolean;
    applicationStatus: string | null;
  } | null>(null); // Broadcaster approval status

  // -------------------------------
  // CAMERA PREVIEW FUNCTIONS
  // -------------------------------
  const startCameraPreview = useCallback(async () => {
    try {
      setIsPreviewLoading(true);
      
      // Stop any existing stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      // Request camera and microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      mediaStreamRef.current = stream;
      
      // Set video element source
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }

      setHasCameraPermission(true);
      setIsCameraOn(true);
      setIsMicOn(true);
      
    } catch (error: any) {
      console.error('Camera preview error:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Camera/microphone access denied. Please allow permissions and try again.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera/microphone found. Please connect a device and try again.');
      } else {
        toast.error('Failed to start camera preview. Please check your devices and permissions.');
      }
      setHasCameraPermission(false);
      setIsCameraOn(false);
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  const stopCameraPreview = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraOn(false);
    setHasCameraPermission(false);
  }, []);

  const toggleCamera = useCallback(() => {
    if (!mediaStreamRef.current) return;
    
    const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
    }
  }, []);

  const toggleMicrophone = useCallback(() => {
    if (!mediaStreamRef.current) return;
    
    const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
    // Prefill broadcaster name if available
    const p = useAuthStore.getState().profile;
    if (p?.username) setBroadcasterName(p.username);
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

    if (!profile.is_broadcaster) {
      toast.error('🚫 You must be an approved broadcaster to go live.');
      return;
    }

    // Note: Camera/microphone permissions will be requested when joining seats in broadcast

    if (!streamTitle.trim()) {
      toast.error('Enter a stream title.');
      return;
    }

    setIsConnecting(true);
    
    // Reset connecting state on function exit to prevent getting stuck
    const cleanup = () => {
      try {
        setIsConnecting(false);
      } catch {}
    };

    // small helper to add timeouts to long-running promises
    const withTimeout = async <T,>(p: Promise<T>, ms = 30000): Promise<T> => {
      let timer: any = null;
      return await Promise.race([
        p.then((v) => {
          if (timer) clearTimeout(timer);
          return v;
        }),
        new Promise((_, rej) => {
          timer = setTimeout(() => rej(new Error('timeout')), ms);
        }) as any,
      ]);
    };

    try {
      const streamId = crypto.randomUUID();
      let thumbnailUrl: string | null = null;

      // Upload thumbnail
      if (thumbnailFile) {
        setUploadingThumbnail(true);

        const fileName = `thumb-${streamId}-${Date.now()}.${thumbnailFile.name.split('.').pop()}`;
        const filePath = `thumbnails/${fileName}`;

        const upload = await supabase.storage
          .from('troll-city-assets')
          .upload(filePath, thumbnailFile, { upsert: false });

        if (!upload.error) {
          const { data: url } = supabase.storage.from('troll-city-assets').getPublicUrl(filePath);
          thumbnailUrl = url.publicUrl;
        }

        setUploadingThumbnail(false);
      }

      // Insert into streams table (use timeout to avoid hanging UI)
      console.log('[GoLive] Inserting stream row into DB...', { streamId, broadcasterId: profile.id });

      // Verify session before insert
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        console.error('[GoLive] No active session before insert');
        toast.error('Session expired. Please sign in again.');
        cleanup();
        return;
      }
      console.log('[GoLive] Session verified, proceeding with insert');

      const insertOperation = supabase
        .from('streams')
        .insert({
          id: streamId,
          broadcaster_id: profile.id,
          title: streamTitle,
          category: category,
          is_live: true,
          status: 'live',
          start_time: new Date().toISOString(),
          thumbnail_url: thumbnailUrl,
          current_viewers: 0,
          total_gifts_coins: 0,
          total_unique_gifters: 0,
          popularity: 0,
          agora_channel: `stream_${streamId}`, // Generate channel name based on stream ID
        })
        .select()
        .single();

      console.log('[GoLive] Executing insert with 15s timeout...');
      
      // Use AbortController for proper timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 15000); // 15 second timeout
      
      const startTime = Date.now();
      let result: any;
      
      try {
        // Note: Supabase doesn't directly support AbortController, but we can wrap it
        const insertPromise = insertOperation;
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Insert operation timed out after 15 seconds')), 15000);
        });
        
        result = await Promise.race([insertPromise, timeoutPromise]);
        clearTimeout(timeoutId);
        
        const duration = Date.now() - startTime;
        console.log(`[GoLive] Insert completed in ${duration}ms`, { hasError: !!result.error, hasData: !!result.data });
      } catch (insertErr: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.error(`[GoLive] Insert failed after ${duration}ms`, insertErr);
        
        // Check if it's a timeout
        if (insertErr?.message?.includes('timeout') || duration >= 15000) {
          toast.error('Stream creation timed out. Please check your network connection and try again.');
          cleanup();
          return;
        }
        
        // Check if it's a network/connection error
        if (insertErr?.message?.includes('fetch') || insertErr?.message?.includes('network') || insertErr?.code === 'ECONNREFUSED') {
          toast.error('Network error: Unable to connect to database. Please check your internet connection.');
          cleanup();
          return;
        }
        
        // Re-throw other errors to be caught by outer catch
        throw insertErr;
      }

      if (result.error) {
        console.error('[GoLive] Supabase insert immediate error:', {
          error: result.error,
          message: result.error?.message,
          details: result.error?.details,
          hint: result.error?.hint,
          code: result.error?.code,
          fullError: result.error
        });
        
        // Show specific error message based on error type
        let errorMessage = 'Failed to start stream.';
        if (result.error?.message?.includes('permission')) {
          errorMessage = 'Permission denied: You may not have broadcaster privileges.';
        } else if (result.error?.message?.includes('duplicate')) {
          errorMessage = 'Stream already exists or duplicate ID conflict.';
        } else if (result.error?.code === '23505') {
          errorMessage = 'Stream ID conflict - please try again.';
        } else if (result.error?.message) {
          errorMessage = `Database error: ${result.error.message}`;
        }
        
        toast.error(errorMessage);
        cleanup();
        return;
      }

      const insertedStream = result.data ?? result;
      const createdId = insertedStream?.id;
      console.log('[GoLive] Insert result check', { 
        hasData: !!result.data, 
        hasInsertedStream: !!insertedStream, 
        createdId,
        insertedStream,
        result 
      });
      
      if (!createdId) {
        console.error('[GoLive] Stream insert did not return an id', { insertedStream, result });
        toast.error('Failed to start stream (no id returned).');
        cleanup();
        return;
      }

      console.log('[GoLive] Stream created successfully, stopping camera preview...');
      
      // Stop camera preview before going to broadcast
      stopCameraPreview();
      
      // ✅ Pass stream data directly via navigation state to avoid database query
      // This eliminates replication delay issues
      const streamDataForNavigation = {
        id: insertedStream.id,
        broadcaster_id: insertedStream.broadcaster_id || profile.id,
        title: insertedStream.title || streamTitle,
        category: insertedStream.category || category,
        status: 'ready_to_join', // Changed from 'live' to wait for seat joining
        is_live: false, // Will be set to true when they join a seat
        start_time: insertedStream.start_time || new Date().toISOString(),
        current_viewers: insertedStream.current_viewers || 0,
        total_gifts_coins: insertedStream.total_gifts_coins || 0,
        total_unique_gifters: insertedStream.total_unique_gifters || 0,
        thumbnail_url: insertedStream.thumbnail_url || thumbnailUrl,
        created_at: insertedStream.created_at || new Date().toISOString(),
        updated_at: insertedStream.updated_at || new Date().toISOString(),
      };
      
      try {
        navigate(`/broadcast/${createdId}?setup=1`, { 
          state: { streamData: streamDataForNavigation, needsSeatJoin: true } 
        });
        console.log('[GoLive] ✅ Navigation called successfully - waiting for seat join');
        toast.success('Stream created! Please join a seat to start broadcasting.');
      } catch (navErr: any) {
        console.error('[GoLive] ❌ Navigation error', navErr);
        toast.error('Stream created but navigation failed. Please navigate manually.');
        cleanup();
        // Don't return here, let it fall through to finally block
      }
    } catch (err: any) {
      console.error('[GoLive] Error starting stream:', {
        error: err,
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
        cause: err?.cause
      });
      
      // Provide specific error messages based on error type
      if (err?.message === 'timeout') {
        toast.error('Starting stream timed out — check network or Supabase and try again.');
      } else if (err?.message?.includes('fetch')) {
        toast.error('Network error: Unable to connect to Supabase. Check your internet connection.');
      } else if (err?.message?.includes('permission') || err?.message?.includes('unauthorized')) {
        toast.error('Permission denied: You may not have the required broadcaster privileges.');
      } else if (err?.message?.includes('JWT')) {
        toast.error('Authentication error: Please log out and log back in.');
      } else if (err?.message) {
        toast.error(`Stream startup failed: ${err.message}`);
      } else {
        toast.error('Error starting stream. Please try again.');
      }
    } finally {
      cleanup();
    }
  };







  return (
    <div className="max-w-6xl mx-auto space-y-6 go-live-wrapper">

      <h1 className="text-3xl font-extrabold flex items-center gap-2">
        <Video className="text-troll-gold w-8 h-8" />
        Go Live
      </h1>

      <div className="host-video-box relative rounded-xl overflow-hidden border border-purple-700/30">
        <div className="w-full h-32 md:h-40 lg:h-48 relative bg-black">
          {!hasCameraPermission ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm mb-3">Camera preview</p>
                <button
                  onClick={startCameraPreview}
                  disabled={isPreviewLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isPreviewLoading ? 'Starting...' : 'Enable Camera'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />
              
              {/* Camera Controls Overlay */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleCamera}
                    className={`p-2 rounded-full transition-colors ${
                      isCameraOn 
                        ? 'bg-gray-800/80 hover:bg-gray-700/80 text-white' 
                        : 'bg-red-600/80 hover:bg-red-500/80 text-white'
                    }`}
                    title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                  >
                    {isCameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={toggleMicrophone}
                    className={`p-2 rounded-full transition-colors ${
                      isMicOn 
                        ? 'bg-gray-800/80 hover:bg-gray-700/80 text-white' 
                        : 'bg-red-600/80 hover:bg-red-500/80 text-white'
                    }`}
                    title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                  >
                    {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    isCameraOn && isMicOn 
                      ? 'bg-green-600/80 text-white' 
                      : 'bg-yellow-600/80 text-white'
                  }`}>
                    {isCameraOn && isMicOn ? 'Ready' : 'Check Settings'}
                  </span>
                </div>
              </div>
              
              {/* Status indicator */}
              <div className="absolute top-3 left-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-black/60 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white text-sm font-medium">Preview</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {!isStreaming ? (
        <div className="bg-[#0E0A1A] border border-purple-700/40 p-6 rounded-xl space-y-6">
          <div>
            <label className="text-gray-300">Stream Title *</label>
            <input
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              className="w-full bg-[#171427] border border-purple-500/40 text-white rounded-lg px-4 py-3"
              placeholder="Enter your stream title..."
            />
          </div>

          <div>
            <label className="text-gray-300">Broadcaster Name *</label>
            <input
              value={broadcasterName}
              onChange={(e) => setBroadcasterName(e.target.value)}
              className="w-full bg-[#171427] border border-purple-500/40 text-white rounded-lg px-4 py-3"
              placeholder="Your display name..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-gray-300">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#171427] border border-purple-500/40 text-white rounded-lg px-4 py-3"
              >
                <option>Chat</option>
                <option>Gaming</option>
                <option>Music</option>
                <option>IRL</option>
              </select>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-gray-300">Options</label>
              <div className="flex items-center gap-3">
                <input id="private" type="checkbox" checked={isPrivateStream} onChange={() => setIsPrivateStream((v) => !v)} />
                <label htmlFor="private" className="text-sm text-gray-300">Private Stream <span className="text-xs text-purple-300">(1000 troll coins)</span></label>
              </div>
              <div className="flex items-center gap-3">
                <input id="paidGuests" type="checkbox" checked={enablePaidGuestBoxes} onChange={() => setEnablePaidGuestBoxes((v) => !v)} />
                <label htmlFor="paidGuests" className="text-sm text-gray-300">Enable Paid Guest Boxes</label>
              </div>
            </div>
          </div>

          <div>
            <label className="text-gray-300">Stream Thumbnail (Optional)</label>
            <div className="mt-2">
              <label className="block w-full border-2 border-dashed border-purple-700/30 rounded-lg p-6 text-center cursor-pointer">
                {thumbnailPreview ? (
                  <img src={thumbnailPreview} className="mx-auto max-h-40 object-contain" />
                ) : (
                  <div className="text-gray-400">Click to upload thumbnail<br/><span className="text-xs text-gray-500">PNG, JPG up to 5MB</span></div>
                )}
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f) {
                      setThumbnailFile(f);
                      setThumbnailPreview(URL.createObjectURL(f));
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleStartStream}
              disabled={isConnecting || !streamTitle.trim() || !broadcasterName.trim() || !hasCameraPermission || !isCameraOn}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-[#10B981] to-[#059669] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Starting…' : 'Go Live Now!'}
            </button>

            {/* Camera status indicator */}
            <div className="text-sm text-gray-400">
              {hasCameraPermission ? (
                <span className="text-green-400">✓ Camera Ready</span>
              ) : (
                <span className="text-yellow-400">⚠ Enable Camera</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-gray-300">Redirecting to stream…</div>
      )}
    </div>
  );
};

export default GoLive;
