import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Headphones,
  Loader2,
  Mic,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type PodcastStatus =
  | "scheduled"
  | "live"
  | "active"
  | "ended"
  | "archived"
  | "draft"
  | "paused"
  | "cancelled";

interface Podcast {
  id: string;
  host_user_id: string;
  title: string;
  description: string | null;
  status: PodcastStatus;
  agora_channel_name: string;
  started_at: string | null;
  ended_at: string | null;
  listener_count: number | null;
  peak_listener_count: number | null;
  created_at: string;
  updated_at: string;
  host_username?: string | null;
}

const LIVE_PODCAST_STATUSES: PodcastStatus[] = ["live", "active"];

function formatCount(n: number | null): string {
  if (!n || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function MobilePodcastPage() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPodcasts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("podcasts")
        .select("*")
        .in("status", ["live", "active", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setPodcasts(data || []);
    } catch (err) {
      console.error("[MobilePodcast] Failed to load podcasts:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPodcasts();
  }, [fetchPodcasts]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPodcasts();
  }, [fetchPodcasts]);

  const livePodcasts = podcasts.filter((p) =>
    LIVE_PODCAST_STATUSES.includes(p.status)
  );
  const upcomingPodcasts = podcasts.filter((p) => p.status === "scheduled");

  return (
    <div className="flex min-h-screen flex-col bg-[#050715] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#050715]/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Mic size={20} className="text-cyan-400" />
          <h1 className="text-lg font-black">Podcast Central</h1>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 size={32} className="animate-spin text-cyan-400" />
            <p className="text-sm text-slate-400">Loading podcasts...</p>
          </div>
        ) : (
          <>
            {/* Live Now Section */}
            <section className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Radio size={16} className="text-red-400" />
                <h2 className="text-sm font-black uppercase tracking-wider text-red-400">
                  Live Now
                </h2>
                {livePodcasts.length > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">
                    {livePodcasts.length}
                  </span>
                )}
              </div>

              {livePodcasts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-6 py-10">
                  <Headphones size={32} className="text-slate-600" />
                  <p className="text-center text-sm text-slate-500">
                    No podcasts live right now.
                    <br />
                    Check back soon!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {livePodcasts.map((podcast) => (
                    <Link
                      key={podcast.id}
                      to={`/podcast/${podcast.id}`}
                      className="group relative overflow-hidden rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/10 to-purple-500/10 p-4 transition hover:border-red-500/40"
                    >
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                        <span className="text-[10px] font-bold text-red-400">LIVE</span>
                      </div>
                      <h3 className="mb-1 pr-16 text-sm font-black text-white">
                        {podcast.title}
                      </h3>
                      {podcast.description && (
                        <p className="mb-3 line-clamp-2 text-xs text-slate-400">
                          {podcast.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Users size={12} />
                          {formatCount(podcast.listener_count)} listening
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Play size={12} />
                          Join
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Upcoming Section */}
            {upcomingPodcasts.length > 0 && (
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-cyan-400" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-cyan-400">
                    Upcoming
                  </h2>
                </div>
                <div className="flex flex-col gap-3">
                  {upcomingPodcasts.map((podcast) => (
                    <Link
                      key={podcast.id}
                      to={`/podcast/${podcast.id}`}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-cyan-500/30"
                    >
                      <h3 className="mb-1 text-sm font-black text-white">
                        {podcast.title}
                      </h3>
                      {podcast.description && (
                        <p className="line-clamp-2 text-xs text-slate-400">
                          {podcast.description}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Start a Podcast CTA */}
            <section className="mb-6">
              <Link
                to="/broadcast/setup"
                className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-4 text-sm font-black text-cyan-400 transition hover:bg-cyan-500/20"
              >
                <Mic size={18} />
                Start a Podcast
              </Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
