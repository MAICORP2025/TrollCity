import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Crown, Users, Video, Shield, Star, Mic } from 'lucide-react';

interface Stream {
  id: string;
  title: string;
  thumbnail_url?: string;
  viewer_count: number;
  broadcaster: {
    id: string;
    username: string;
    avatar_url?: string;
    role: string;
    troll_role?: string;
    is_lead_officer?: boolean;
    is_admin?: boolean;
  };
}

export default function HomeLiveGrid() {
  const navigate = useNavigate();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchStreams = async () => {
    try {
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          thumbnail_url,
          viewer_count,
          user_profiles!broadcaster_id (
            id,
            username,
            avatar_url,
            role,
            troll_role,
            is_lead_officer,
            is_admin
          )
        `)
        .eq('is_live', true)
        .eq('status', 'live');

      if (error) throw error;

      const formatted: Stream[] = (data || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        thumbnail_url: s.thumbnail_url,
        viewer_count: s.viewer_count || 0,
        broadcaster: Array.isArray(s.user_profiles) ? s.user_profiles[0] : s.user_profiles
      }));

      // Sorting Logic
      formatted.sort((a, b) => {
        const getWeight = (s: Stream) => {
          const p = s.broadcaster;
          // Admin #1
          if (p.role === 'admin' || p.is_admin || p.troll_role === 'admin') return 1000;
          // Secretary #2
          if (p.role === 'secretary' || p.troll_role === 'secretary') return 900;
          // Lead Troll Officer
          if (p.is_lead_officer || p.role === 'lead_troll_officer' || p.troll_role === 'lead_troll_officer') return 800;
          // Troll Officer
          if (p.role === 'troll_officer' || p.troll_role === 'troll_officer') return 700;
          
          return 0; // Regular users
        };

        return getWeight(b) - getWeight(a);
      });

      setStreams(formatted);
    } catch (err) {
      console.error('Error fetching live streams:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-video bg-slate-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (streams.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/5">
        <Video className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">No active broadcasts</h3>
        <p className="text-slate-400">Be the first to go live!</p>
        <button 
          onClick={() => navigate('/go-live')}
          className="mt-6 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
        >
          Go Live
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {streams.map((stream) => {
        // Determine badge
        let BadgeIcon = null;
        let badgeColor = '';
        let badgeLabel = '';

        const p = stream.broadcaster;
        if (p.role === 'admin' || p.is_admin || p.troll_role === 'admin') {
          BadgeIcon = Crown;
          badgeColor = 'text-yellow-400';
          badgeLabel = 'Admin';
        } else if (p.role === 'secretary' || p.troll_role === 'secretary') {
          BadgeIcon = Star;
          badgeColor = 'text-pink-400';
          badgeLabel = 'Secretary';
        } else if (p.is_lead_officer || p.role === 'lead_troll_officer' || p.troll_role === 'lead_troll_officer') {
          BadgeIcon = Shield;
          badgeColor = 'text-emerald-400';
          badgeLabel = 'Lead Officer';
        } else if (p.role === 'troll_officer' || p.troll_role === 'troll_officer') {
          BadgeIcon = Shield;
          badgeColor = 'text-blue-400';
          badgeLabel = 'Officer';
        }

        return (
          <div 
            key={stream.id}
            onClick={() => navigate(`/live/${stream.id}`)}
            className="group relative bg-slate-900/50 rounded-2xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] cursor-pointer"
          >
            {/* Thumbnail */}
            <div className="aspect-video relative bg-slate-950">
              {stream.thumbnail_url ? (
                <img src={stream.thumbnail_url} alt={stream.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                  <Video className="w-12 h-12 text-slate-700 group-hover:text-purple-500/50 transition-colors" />
                </div>
              )}
              
              {/* Live Badge */}
              <div className="absolute top-3 left-3 px-2 py-1 bg-red-600 text-white text-xs font-bold rounded flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                LIVE
              </div>

              {/* Viewer Count */}
              <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-medium rounded flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {stream.viewer_count.toLocaleString()}
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="relative">
                  <img 
                    src={stream.broadcaster.avatar_url || `https://ui-avatars.com/api/?name=${stream.broadcaster.username}`}
                    alt={stream.broadcaster.username}
                    className="w-10 h-10 rounded-full border-2 border-slate-800 object-cover"
                  />
                  {BadgeIcon && (
                    <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-full p-0.5 border border-slate-700">
                      <BadgeIcon className={`w-3 h-3 ${badgeColor}`} />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                    {stream.title || `${stream.broadcaster.username}'s Stream`}
                  </h3>
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    {stream.broadcaster.username}
                    {badgeLabel && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 ${badgeColor}`}>
                        {badgeLabel}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
