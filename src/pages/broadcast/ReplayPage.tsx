import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface ReplayData {
  id: string;
  stream_id: string;
  user_id: string;
  title: string;
  replay_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string;
  user_profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function ReplayPage() {
  const { streamId } = useParams();
  const navigate = useNavigate();
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const egressRecordedRef = useRef(false);

  useEffect(() => {
    if (!streamId) {
      setError('No replay ID provided');
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchReplay = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('broadcast_replays')
          .select('*, user_profiles(username, avatar_url)')
          .eq('stream_id', streamId)
          .maybeSingle();

        if (cancelled) return;

        if (fetchError) throw fetchError;

        if (!data) {
          setError('Replay not found');
          setLoading(false);
          return;
        }

        setReplay(data as ReplayData);
      } catch (err: any) {
        console.error('[ReplayPage] Error fetching replay:', err);
        setError(err?.message || 'Failed to load replay');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReplay();
    return () => { cancelled = true; };
  }, [streamId]);

  useEffect(() => {
    if (!replay || !videoRef.current || egressRecordedRef.current) return;

    const video = videoRef.current;
    const egressInterval = setInterval(async () => {
      if (egressRecordedRef.current) return;
      if (!video.duration || video.duration < 1) return;
      if (video.paused) return;

      const currentTime = video.currentTime;
      const duration = video.duration;

      // Record every 1 minute of watch time (or at 10% and 50% marks for short videos)
      const watchedRatio = currentTime / duration;
      if (watchedRatio < 0.05) return;

      // Calculate minutes watched (incremental)
      const minutesWatched = Math.max(1, Math.floor(currentTime / 60));
      if (minutesWatched < 1) return;

      egressRecordedRef.current = true;

      try {
        const { data: result, error: rpcError } = await supabase.rpc('record_replay_view', {
          p_creator_user_id: replay.user_id,
          p_stream_id: replay.stream_id,
          p_viewer_user_id: (await supabase.auth.getUser())?.data?.user?.id || null,
          p_minutes_watched: minutesWatched,
        });

        if (rpcError) {
          console.warn('[ReplayPage] Replay view error:', rpcError);
          return;
        }

        if (result?.error) {
          console.warn('[ReplayPage] Replay rejected:', result.error);
          if (result?.restricted) {
            toast.error('Replay playback unavailable. Creator replay balance exhausted.');
          }
          return;
        }

        if (result?.charged) {
          console.log('[ReplayPage] Replay charged:', result.charged, 'coins for', minutesWatched, 'min');
        }
      } catch (err: any) {
        console.warn('[ReplayPage] Replay view failed:', err);
      }
    }, 60000);

    return () => clearInterval(egressInterval);
  }, [replay]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error || !replay) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-white/10 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-bold mb-2">Replay Unavailable</h1>
          <p className="text-zinc-400 text-sm mb-6">{error || 'This replay could not be found.'}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition flex items-center justify-center gap-2"
          >
            <ArrowLeft size={18} />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return 'Unknown';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto p-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition mb-4 text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="w-full aspect-video bg-zinc-900 rounded-2xl overflow-hidden mb-6 relative">
          <video
            ref={videoRef}
            src={replay.replay_url}
            controls
            autoPlay
            poster={replay.thumbnail_url || undefined}
            className="w-full h-full object-contain bg-black"
            playsInline
          />
        </div>

        <div className="space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold">{replay.title}</h1>

          {replay.user_profiles && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-300">
                {replay.user_profiles.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm text-zinc-300">{replay.user_profiles.username}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
            {replay.duration_seconds && (
              <span>Duration: {formatDuration(replay.duration_seconds)}</span>
            )}
            {replay.file_size_bytes && (
              <span>Size: {formatFileSize(replay.file_size_bytes)}</span>
            )}
            <span>Archived: {formatDate(replay.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
