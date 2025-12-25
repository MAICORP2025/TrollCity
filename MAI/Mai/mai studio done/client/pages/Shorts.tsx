import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Share2, Flame } from "lucide-react";
import { Layout } from "@/components/Layout";
import { fetchTrendingShorts, Video } from "@/lib/supabaseClient";
import { formatNumber, formatRelativeTime } from "@/utils/index";
import { Skeleton } from "@/components/ui/skeleton";

export default function Shorts() {
  const [shorts, setShorts] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadShorts();
  }, []);

  const loadShorts = async () => {
    try {
      setIsLoading(false);
      const data = await fetchTrendingShorts();
      setShorts(data);
    } catch (error) {
      console.error("Error loading shorts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScroll = (direction: "up" | "down") => {
    if (direction === "down" && currentIndex < shorts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (direction === "up" && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentShort = shorts[currentIndex];

  return (
    <Layout>
      <div className="min-h-screen bg-black">
        {/* Header */}
        <div className="fixed top-20 left-0 right-0 z-20 pointer-events-none">
          <div className="container-wide">
            <div className="flex items-center gap-3 pointer-events-auto">
              <Flame className="text-red-500" size={32} />
              <h1 className="text-3xl md:text-4xl font-bold text-white">
                Trending Shorts
              </h1>
            </div>
          </div>
        </div>

        {isLoading ? (
          // Loading skeleton
          <div className="h-screen flex items-center justify-center">
            <div className="w-full max-w-md space-y-4">
              <Skeleton className="w-full h-[600px] rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ) : shorts.length === 0 ? (
          // Empty state
          <div className="h-screen flex items-center justify-center">
            <div className="text-center">
              <Flame className="mx-auto mb-4 text-gray-600" size={64} />
              <h2 className="text-2xl font-bold text-gray-400 mb-2">
                No Shorts Available
              </h2>
              <p className="text-gray-500 mb-6">
                Be the first to upload a short!
              </p>
              <Link to="/upload" className="neon-btn-red">
                Upload Now
              </Link>
            </div>
          </div>
        ) : (
          // Vertical shorts feed
          <div className="h-screen overflow-hidden flex items-center justify-center pt-20">
            <div className="w-full max-w-md h-full flex flex-col items-center justify-center">
              {/* Short Video Container */}
              <div className="w-full h-[600px] bg-black rounded-2xl overflow-hidden relative group shadow-2xl shadow-red-500/20">
                {/* Video */}
                {currentShort.video_url && (
                  <video
                    key={currentShort.id}
                    src={currentShort.video_url}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                  />
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-40"></div>

                {/* Top Info */}
                <div className="absolute top-4 left-4 right-4 z-10">
                  <div className="flex items-center gap-2 w-fit px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20">
                    <Flame size={16} className="text-red-500" />
                    <span className="text-xs text-white font-semibold">
                      Trending
                    </span>
                  </div>
                </div>

                {/* Side Actions */}
                <div className="absolute right-4 bottom-24 flex flex-col gap-6 z-20">
                  <button className="flex flex-col items-center gap-2 group/action">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md group-hover/action:bg-red-500 transition-colors flex items-center justify-center neon-border-red">
                      <Heart
                        size={24}
                        className="text-white group-hover/action:text-white"
                        fill="white"
                      />
                    </div>
                    <span className="text-xs text-white font-semibold">
                      {formatNumber(currentShort.likes)}
                    </span>
                  </button>

                  <button className="flex flex-col items-center gap-2 group/action">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md group-hover/action:bg-blue-500 transition-colors flex items-center justify-center hover:neon-border-gold">
                      <MessageCircle size={24} className="text-white" />
                    </div>
                    <span className="text-xs text-white font-semibold">
                      Comments
                    </span>
                  </button>

                  <button className="flex flex-col items-center gap-2 group/action">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md group-hover/action:bg-yellow-500 transition-colors flex items-center justify-center neon-border-gold">
                      <Share2 size={24} className="text-white" />
                    </div>
                    <span className="text-xs text-white font-semibold">
                      Share
                    </span>
                  </button>
                </div>

                {/* Bottom Info */}
                <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                  <div className="space-y-3">
                    {/* Creator Info */}
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-red-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {currentShort.creator_id.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">
                          Creator #{currentShort.creator_id.slice(0, 8)}
                        </p>
                        <p className="text-gray-300 text-xs">
                          {formatRelativeTime(currentShort.created_at)}
                        </p>
                      </div>
                      <button className="neon-btn-gold px-4 py-1 text-xs font-semibold">
                        Follow
                      </button>
                    </div>

                    {/* Title and Description */}
                    <div>
                      <h2 className="text-white font-bold text-sm line-clamp-2">
                        {currentShort.title}
                      </h2>
                      {currentShort.series && (
                        <p className="text-yellow-400 text-xs font-semibold mt-1">
                          {currentShort.series.name}
                        </p>
                      )}
                      {currentShort.description && (
                        <p className="text-gray-300 text-xs mt-1 line-clamp-2">
                          {currentShort.description}
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 text-xs text-gray-300 pt-2 border-t border-white/20">
                      <span>{formatNumber(currentShort.views)} views</span>
                      <span>{formatNumber(currentShort.likes)} likes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-4 mt-6 justify-center">
                <button
                  onClick={() => handleScroll("up")}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-full border border-white/20 hover:border-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>

                <div className="text-sm text-gray-400">
                  {currentIndex + 1} / {shorts.length}
                </div>

                <button
                  onClick={() => handleScroll("down")}
                  disabled={currentIndex === shorts.length - 1}
                  className="p-2 rounded-full border border-white/20 hover:border-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              {/* Watch Now CTA */}
              <Link
                to={`/watch/${currentShort.id}`}
                className="mt-6 neon-btn-red"
              >
                Watch Full Details
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
