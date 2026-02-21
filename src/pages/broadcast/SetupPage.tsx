import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { PreflightStore } from '@/lib/preflightStore';
import { Video, VideoOff, Mic, MicOff, AlertTriangle, RefreshCw, Radio, Youtube, Users, BookOpen, Dumbbell, Briefcase, Heart, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { MobileErrorLogger } from '@/lib/MobileErrorLogger';
import { generateUUID } from '../../lib/uuid';
import {
  BROADCAST_CATEGORIES,
  getCategoryConfig,
  supportsBattles,
  getMatchingTerminology,
  requiresReligion,
  forceRearCamera,
  allowFrontCamera,
  getMaxBoxCount,
  AVAILABLE_RELIGIONS,
  BroadcastCategoryId
} from '../../config/broadcastCategories';

// Format time as HH:MM or MM:SS
function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Category icon component
function CategoryIcon({ categoryId }: { categoryId: string }) {
  const config = getCategoryConfig(categoryId);
  switch (categoryId) {
    case 'general': return <span className="text-2xl">💬</span>;
    case 'just_chatting': return <span className="text-2xl">☕</span>;
    case 'gaming': return <span className="text-2xl">🎮</span>;
    case 'music': return <span className="text-2xl">🎵</span>;
    case 'irl': return <span className="text-2xl">📍</span>;
    case 'debate': return <span className="text-2xl">⚖️</span>;
    case 'education': return <span className="text-2xl">📚</span>;
    case 'fitness': return <span className="text-2xl">💪</span>;
    case 'business': return <span className="text-2xl">💼</span>;
    case 'spiritual': return <span className="text-2xl">✝️</span>;
    case 'trollmers': return <span className="text-2xl">🏆</span>;
    default: return <span className="text-2xl">💬</span>;
  }
}

export default function SetupPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BroadcastCategoryId>('general');
  const [loading, setLoading] = useState(false);
  
  // Category-specific state
  const [selectedReligion, setSelectedReligion] = useState<string>('');
  const [streamKey, setStreamKey] = useState<string>('');
  const [showOBSPanel, setShowOBSPanel] = useState(false);
  
  // Pre-generate stream ID for token optimization
  const [streamId] = useState(() => generateUUID());

  // Track if we are navigating to broadcast to prevent cleanup
  const isStartingStream = useRef(false);
  const hasPrefetched = useRef<string | null>(null);

  // Get category config
  const categoryConfig = getCategoryConfig(category);
  const categorySupportsBattles = supportsBattles(category);
  const categoryMatchingTerm = getMatchingTerminology(category);
  const categoryRequiresReligion = requiresReligion(category);
  const shouldForceRearCamera = forceRearCamera(category);
  const canUseFrontCamera = allowFrontCamera(category);
  const maxBoxes = getMaxBoxCount(category);

  // Media state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [followerCount, setFollowerCount] = useState<number>(0);

  // Generate stream key for gaming category
  useEffect(() => {
    if (category === 'gaming') {
      // Generate a random stream key
      const key = `troll_${generateUUID().substring(0, 8)}`;
      setStreamKey(key);
      setShowOBSPanel(true);
    } else {
      setShowOBSPanel(false);
    }
  }, [category]);

  // Handle camera facing mode based on category
  useEffect(() => {
    if (shouldForceRearCamera) {
      setFacingMode('environment');
    } else if (!canUseFrontCamera) {
      // If front camera not allowed but we were on it, switch to rear
      if (facingMode === 'user') {
        setFacingMode('environment');
      }
    }
  }, [category, shouldForceRearCamera, canUseFrontCamera]);

  // Fetch follower count for Trollmers eligibility
  useEffect(() => {
    async function fetchFollowerCount() {
      if (!user?.id) return;
      const { count } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);
      setFollowerCount(count || 0);
    }
    fetchFollowerCount();
  }, [user?.id]);

  useEffect(() => {
    let localStream: MediaStream | null = null;

    // Check for multiple cameras
    navigator.mediaDevices?.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
    });

    // Request camera access on mount
    async function getMedia() {
      // Check for getUserMedia support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'getUserMedia not supported in this browser/context';
        console.error(`[SetupPage] ${errorMsg}`);
        const isSecure = window.isSecureContext;
        
        MobileErrorLogger.logError(new Error(errorMsg), 'SetupPage:getUserMediaCheck');

        if (!isSecure) {
           toast.error(
             <div className="flex flex-col gap-1">
               <span className="font-bold">Camera Blocked by Browser Security</span>
               <span className="text-xs">
                 Browsers block camera access on HTTP (http://{window.location.host}).
                 <br/><br/>
                 <strong>FIX for Chrome/Edge:</strong>
                 <br/>
                 1. Go to <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>
                 <br/>
                 2. Add <code>http://{window.location.hostname}:5176</code>
                 <br/>
                 3. Enable & Relaunch
               </span>
             </div>,
             { duration: 10000 }
           );
        } else {
           toast.error('Camera access is not supported in this browser.');
        }
        return;
      }

      try {
        // Stop previous tracks if any
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode }, 
          audio: true 
        });
        localStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.warn("Error accessing media devices, trying audio only.", err);
        MobileErrorLogger.logError(err, 'SetupPage:getUserMedia');

        if (err.name === 'NotAllowedError') {
             toast.error("Camera permission denied. Please allow access in browser settings.");
             return;
        }

        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            localStream = audioStream;
            setStream(audioStream);
            setIsVideoEnabled(false);
            toast.warning("Camera not found. Audio only mode.");
        } catch (audioErr) {
            console.error("No media devices found.", audioErr);
            toast.error("Could not access microphone either.");
        }
      }
    }
    getMedia();

    return () => {
      // Cleanup stream only if NOT starting stream
      if (localStream && !isStartingStream.current) {
        console.log('[SetupPage] Cleaning up media stream');
        localStream.getTracks().forEach(track => track.stop());
      } else if (isStartingStream.current && localStream) {
        console.log('[SetupPage] Preserving media stream for broadcast');
        PreflightStore.setStream(localStream);
      }
    };
  }, [facingMode, stream]); // Re-run when facing mode changes

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const flipCamera = () => {
    if (!canUseFrontCamera && facingMode === 'environment') {
      toast.error('Front camera is not available for this category');
      return;
    }
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleStartStream = async () => {
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }

    // Check religion requirement for spiritual category
    if (categoryRequiresReligion && !selectedReligion) {
      toast.error('Please select your religion');
      return;
    }

    // Check Trollmers requirements
    if (category === 'trollmers') {
      if (followerCount < 100 && profile?.role !== 'admin') {
        toast.error('Trollmers requires 100+ followers');
        return;
      }
      if (!isVideoEnabled && profile?.role !== 'admin') {
        toast.error('Trollmers requires camera enabled');
        return;
      }
    }

    // Check camera requirement for categories that need it
    if (categoryConfig.requiresCamera && !isVideoEnabled) {
      toast.error(`Camera is required for ${categoryConfig.name}`);
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('streams')
        .insert({
          id: streamId,
          user_id: user.id,
          title,
          category,
          stream_kind: category === 'trollmers' ? 'trollmers' : 'regular',
          camera_ready: isVideoEnabled,
          status: 'starting',
          is_live: true,
          started_at: new Date().toISOString(),
          box_count: categoryConfig.defaultBoxCount,
          layout_mode: categoryConfig.layoutMode === 'debate' ? 'split' : 
                       categoryConfig.layoutMode === 'classroom' ? 'grid' :
                       categoryConfig.layoutMode === 'spotlight' ? 'spotlight' : 'grid',
          // Store category-specific data
          ...(category === 'spiritual' && { selected_religion: selectedReligion }),
          ...(category === 'gaming' && { stream_key: streamKey }),
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      toast.success('Stream created! Going live...');
      isStartingStream.current = true;
      navigate(`/broadcast/${data.id}`);
    } catch (err: any) {
      console.error('Error creating stream:', err);
      toast.error(err.message || 'Failed to start stream');
    } finally {
      setLoading(false);
    }
  };

  const copyStreamKey = () => {
    navigator.clipboard.writeText(streamKey);
    toast.success('Stream key copied!');
  };

  // Render OBS Panel for Gaming category
  const renderOBSPanel = () => {
    if (!showOBSPanel) return null;
    
    return (
      <div className="bg-slate-950/80 border border-blue-500/30 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-blue-400">
          <Radio size={18} />
          <span className="font-semibold">OBS Streaming Setup</span>
        </div>
        
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-400">RTMP Ingest URL:</span>
            <code className="block bg-black/50 p-2 rounded text-blue-300 text-xs mt-1">
              rtmp://live.trollcity.app/live
            </code>
          </div>
          
          <div>
            <span className="text-gray-400">Stream Key:</span>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 bg-black/50 p-2 rounded text-green-400 text-xs break-all">
                {streamKey}
              </code>
              <button
                onClick={copyStreamKey}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white"
              >
                Copy
              </button>
            </div>
          </div>
          
          <p className="text-xs text-gray-500">
            Use these settings in OBS Studio → Settings → Stream
          </p>
        </div>
      </div>
    );
  };

  // Render Religion Selector for Spiritual category
  const renderReligionSelector = () => {
    if (!categoryRequiresReligion) return null;
    
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Select Your Faith *
        </label>
        <select
          value={selectedReligion}
          onChange={(e) => setSelectedReligion(e.target.value)}
          className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-gray-300"
        >
          <option value="">Choose your religion...</option>
          {AVAILABLE_RELIGIONS.map(religion => (
            <option key={religion} value={religion}>{religion}</option>
          ))}
        </select>
        <p className="text-xs text-gray-500">
          You'll only be matched with broadcasters of the same faith
        </p>
      </div>
    );
  };

  // Render Battle/Match info for categories that support it
  const renderBattleInfo = () => {
    if (!categorySupportsBattles) return null;
    
    return (
      <div className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-amber-400">
          <Swords size={18} />
          <span className="font-semibold">{categoryMatchingTerm} Available</span>
        </div>
        
        {category === 'trollmers' && (
          <>
            {profile?.role === 'admin' && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-2 mb-2">
                <p className="text-xs text-green-300 font-bold">🛡️ ADMIN MODE: Follower requirement bypassed for testing</p>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Followers:</span>
              <span className={`font-bold ${followerCount >= 100 || profile?.role === 'admin' ? 'text-green-400' : 'text-red-400'}`}>
                {followerCount} / 100 {profile?.role === 'admin' && '(Admin Bypass ✓)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">Camera Ready:</span>
              <span className={`font-bold ${isVideoEnabled ? 'text-green-400' : 'text-red-400'}`}>
                {isVideoEnabled ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            {(followerCount < 100 && profile?.role !== 'admin') && !isVideoEnabled && (
              <p className="text-xs text-amber-300 mt-2">
                ⚠️ Trollmers requires 100+ followers and camera enabled
              </p>
            )}
            {(followerCount < 100 && profile?.role !== 'admin') && isVideoEnabled && (
              <p className="text-xs text-amber-300 mt-2">
                ⚠️ Trollmers requires 100+ followers
              </p>
            )}
            {followerCount >= 100 && !isVideoEnabled && (
              <p className="text-xs text-amber-300 mt-2">
                ⚠️ Trollmers requires camera enabled
              </p>
            )}
          </>
        )}
        
        {category === 'business' && (
          <p className="text-xs text-gray-400">
            Click the {categoryMatchingTerm} button during your broadcast to find other business broadcasters to connect with.
          </p>
        )}
        
        {category === 'spiritual' && (
          <p className="text-xs text-gray-400">
            Click the {categoryMatchingTerm} button during your broadcast to find other broadcasters of the same faith.
          </p>
        )}
      </div>
    );
  };

  // Render category-specific info
  const renderCategoryInfo = () => {
    switch (category) {
      case 'debate':
        return (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-sm">
            <p className="text-blue-300">⚖️ Split-screen debate layout with exactly 2 participants</p>
          </div>
        );
      case 'education':
        return (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm">
            <p className="text-green-300">📚 Classroom layout - You're the Teacher, guests are Students</p>
          </div>
        );
      case 'fitness':
        return (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 text-sm">
            <p className="text-orange-300">💪 One-way broadcast - You're the Trainer</p>
          </div>
        );
      case 'irl':
        return (
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 text-sm">
            <p className="text-pink-300">📍 Rear camera only for first-person streaming</p>
          </div>
        );
      case 'music':
        return (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-sm">
            <p className="text-purple-300">🎵 Add up to 4 guest boxes (YouTube player counts as one)</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Preview Section */}
        <div className="space-y-4">
          <div className="aspect-video bg-black rounded-2xl overflow-hidden relative border border-white/10 shadow-2xl">
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover transform scale-x-[-1]" 
            />
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
              <button 
                onClick={toggleVideo}
                className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
                disabled={categoryConfig.requiresCamera && !isVideoEnabled}
              >
                {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button 
                onClick={toggleAudio}
                className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500/80 hover:bg-red-600/80'}`}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              
              {hasMultipleCameras && canUseFrontCamera && (
                  <button 
                    onClick={flipCamera}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    title="Flip Camera"
                  >
                    <RefreshCw size={20} />
                  </button>
              )}
              
              {/* Show warning if front camera not allowed */}
              {shouldForceRearCamera && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-pink-500/80 px-3 py-1 rounded-full text-xs whitespace-nowrap">
                  📍 Rear Camera Only
                </div>
              )}
            </div>
          </div>
          <p className="text-center text-sm text-gray-400">
            Check your camera and microphone before going live
          </p>
        </div>

        {/* Form Section */}
        
        <div className="space-y-6 bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-xl overflow-y-auto max-h-[90vh]">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-amber-600 bg-clip-text text-transparent">Go Live</h1>
            <p className="text-gray-400">Set up your broadcast details</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Stream Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Late Night Chill & Trolling"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all placeholder:text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BroadcastCategoryId)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all text-gray-300"
              >
                <option value="general">💬 General Chat</option>
                <option value="just_chatting">☕ Just Chatting</option>
                <option value="gaming">🎮 Gaming</option>
                <option value="music">🎵 Music</option>
                <option value="irl">📍 IRL / Lifestyle</option>
                <option value="debate">⚖️ Debate & Discussion</option>
                <option value="education">📚 Education</option>
                <option value="fitness">💪 Fitness & Sports</option>
                <option value="business">💼 Business & Finance</option>
                <option value="spiritual">✝️ Spiritual / Church</option>
                <option value="trollmers">🏆 Trollmers Head-to-Head</option>
              </select>
            </div>

            {/* Category-specific info */}
            {renderCategoryInfo()}

            {/* OBS Panel for Gaming */}
            {renderOBSPanel()}

            {/* Religion Selector for Spiritual */}
            {renderReligionSelector()}

            {/* Battle/Match Info */}
            {renderBattleInfo()}

            <button
              onClick={handleStartStream}
              disabled={loading || !title.trim() || (categoryRequiresReligion && !selectedReligion)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-bold text-lg hover:from-yellow-300 hover:to-amber-500 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></span>
                  Creating your stream...
                </span>
              ) : (
                'Start Broadcast'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
