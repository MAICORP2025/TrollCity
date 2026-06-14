import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Home, Trophy, Coins, Gift, Heart, UserPlus, Loader2, Play, Bookmark } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

interface StreamStats {
  title: string;
  totalLikes: number;
  createdAt: string;
  endedAt?: string;
  broadcasterId: string;
}

interface UserStats {
  trollmondsSpent: number;
  giftsReceived: number;
  newFollowers: number;
}

interface ReplayInfo {
  id: string;
  replay_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
}

export default function StreamSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { streamId } = useParams();
  const { user, profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    trollmondsSpent: 0,
    giftsReceived: 0,
    newFollowers: 0
  });
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replay, setReplay] = useState<ReplayInfo | null>(null);

  useEffect(() => {
    if (!streamId) {
      setLoading(false);
      return;
    }

    const fetchStreamStats = async () => {
      try {
        const { data: stream, error } = await supabase
          .from('streams')
          .select('title, total_likes, created_at, ended_at, user_id')
          .eq('id', streamId)
          .maybeSingle();

        if (error) throw error;

        const broadcasterId = stream?.user_id || '';
        const streamCreatedAt = stream?.created_at || new Date().toISOString();
        const streamEndedAt = stream?.ended_at || new Date().toISOString();

        setStreamStats({
          title: stream?.title || 'Stream Ended',
          totalLikes: stream?.total_likes || 0,
          createdAt: streamCreatedAt,
          endedAt: streamEndedAt,
          broadcasterId
        });

        const userIsBroadcaster = user?.id === broadcasterId;
        setIsBroadcaster(userIsBroadcaster);

        if (userIsBroadcaster && user?.id && streamId && !isSaved) {
          try {
            await supabase
              .from('saved_streams')
              .upsert({
                user_id: user.id,
                stream_id: streamId,
                source: 'auto_stream_end',
                storage_category: 'broadcast_recording',
              }, { onConflict: 'saved_streams_user_id_stream_id_key' });
            setIsSaved(true);
          } catch (err: any) {
            if (err.code !== '23505') {
              console.error('Error auto-saving stream:', err);
            } else {
              setIsSaved(true);
            }
          }
        }

        const { data: replayData } = await supabase
          .from('broadcast_replays')
          .select('id, replay_url, thumbnail_url, duration_seconds')
          .eq('stream_id', streamId)
          .maybeSingle();

        if (replayData) {
          setReplay(replayData as ReplayInfo);
        }

        let trollmondsSpent = 0;
        let giftsReceived = 0;
        let newFollowers = 0;

        if (user?.id) {
          const { data: streamGiftsSpent, error: streamGiftsSpentError } = await supabase
            .from('stream_gifts')
            .select('id, trollmonds_spent, metadata')
            .eq('stream_id', streamId)
            .eq('sender_id', user.id);

          if (streamGiftsSpent && streamGiftsSpent.length > 0) {
            trollmondsSpent = streamGiftsSpent.reduce((sum: number, g: any) => {
              const spent = g.trollmonds_spent ?? g.metadata?.trollmonds_spent ?? g.metadata?.trollmonds_deducted ?? 0;
              return sum + (typeof spent === 'number' ? spent : 0);
            }, 0);
          }

          const { data: streamGiftsReceived, error: streamGiftsReceivedError } = await supabase
            .from('stream_gifts')
            .select('id, quantity')
            .eq('stream_id', streamId)
            .eq('receiver_id', user.id);

          if (streamGiftsReceived && streamGiftsReceived.length > 0) {
            giftsReceived = streamGiftsReceived.reduce((sum: number, g: any) => {
              return sum + (g.quantity || 1);
            }, 0);
          }

          const { data: artistProfile } = await supabase
            .from('artist_profiles')
            .select('id')
            .eq('user_id', broadcasterId)
            .maybeSingle();

          if (artistProfile?.id) {
            const { count: followerCount } = await supabase
              .from('artist_followers')
              .select('id', { count: 'exact' })
              .eq('artist_id', artistProfile.id)
              .gte('created_at', streamCreatedAt)
              .lte('created_at', streamEndedAt);

            newFollowers = followerCount || 0;
          }
        }

        setUserStats({
          trollmondsSpent,
          giftsReceived,
          newFollowers
        });
      } catch (err) {
        console.error('Error fetching stream stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStreamStats();
  }, [streamId, user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
      </div>
    );
  }

  const displayStreamStats = streamStats || {
    title: 'Stream Ended',
    totalLikes: 0,
    broadcasterId: ''
  };

  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toLocaleString();
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col items-center p-4 overflow-y-auto">
      <div className="max-w-lg w-full bg-zinc-900 border border-white/10 rounded-2xl p-5 sm:p-8 flex flex-col items-center text-center shadow-2xl my-auto shrink-0">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4 sm:mb-6 ring-1 ring-yellow-500/50">
          <Trophy size={32} className="text-yellow-500 sm:hidden" />
          <Trophy size={40} className="text-yellow-500 hidden sm:block" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Broadcast Ended</h1>
        <p className="text-zinc-400 mb-4 sm:mb-8 text-sm sm:text-base">{displayStreamStats.title || "Great stream! Here's how it went:"}</p>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-4 sm:mb-8">
          <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex flex-col items-center border border-white/5">
            <Coins className="text-yellow-400 mb-1 sm:mb-2" size={24} />
            <span className="text-2xl sm:text-3xl font-bold text-yellow-400">
              {formatValue(userStats.trollmondsSpent)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mt-1">Trollmonds Spent</span>
          </div>

          <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex flex-col items-center border border-white/5">
            <Gift className="text-pink-400 mb-1 sm:mb-2" size={24} />
            <span className="text-2xl sm:text-3xl font-bold text-pink-400">
              {formatValue(userStats.giftsReceived)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mt-1">Gifts Received</span>
          </div>

          <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex flex-col items-center border border-white/5">
            <Heart className="text-red-400 mb-1 sm:mb-2" size={24} />
            <span className="text-2xl sm:text-3xl font-bold text-red-400">
              {formatValue(displayStreamStats.totalLikes)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mt-1">Total Likes</span>
          </div>

          <div className="bg-black/40 rounded-xl p-3 sm:p-4 flex flex-col items-center border border-white/5">
            <UserPlus className="text-green-400 mb-1 sm:mb-2" size={24} />
            <span className="text-2xl sm:text-3xl font-bold text-green-400">
              {formatValue(userStats.newFollowers)}
            </span>
            <span className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wider mt-1">New Followers</span>
          </div>
        </div>

        {user && (
          <div className="mb-4 sm:mb-6 w-full space-y-2">
            <div className="p-2 sm:p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <p className="text-xs sm:text-sm text-purple-300">
                {isBroadcaster
                  ? "You're the broadcaster!"
                  : `Watching as: ${profile?.username || 'User'}`
                }
              </p>
            </div>

            {isBroadcaster && (
              <div className={`p-2 sm:p-3 rounded-lg border text-xs sm:text-sm flex items-center justify-center gap-2 ${
                isSaved
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
              }`}>
                {isSaved ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                    </svg>
                    Saved to Profile
                  </>
                ) : (
                  'Not saved to profile'
                )}
              </div>
            )}

            {replay && (
              <button
                onClick={() => navigate(`/replay/${streamId}`)}
                className="w-full p-2 sm:p-3 rounded-lg border text-xs sm:text-sm flex items-center justify-center gap-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition"
              >
                <Play size={14} />
                Watch Replay
                {replay.duration_seconds && (
                  <span className="text-emerald-500/70">({formatDuration(replay.duration_seconds)})</span>
                )}
              </button>
            )}
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition flex items-center justify-center gap-2"
        >
          <Home size={20} />
          Back to Home
        </button>
      </div>
    </div>
  );
}
