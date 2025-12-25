import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Flame, Zap, Upload } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Hero } from "@/components/Hero";
import { fetchFeaturedVideos, fetchTrendingShorts, fetchMovies, Video } from "@/lib/supabaseClient";
import { formatNumber, truncateText, formatRelativeTime } from "@/utils/index";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const [featuredVideos, setFeaturedVideos] = useState<Video[]>([]);
  const [trendingShorts, setTrendingShorts] = useState<Video[]>([]);
  const [movies, setMovies] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHomeContent();
  }, []);

  const loadHomeContent = async () => {
    try {
      setIsLoading(true);
      // Load all content in parallel
      const [featured, shorts, moviesData] = await Promise.all([
        fetchFeaturedVideos(),
        fetchTrendingShorts(),
        fetchMovies(),
      ]);

      setFeaturedVideos(featured);
      setTrendingShorts(shorts);
      setMovies(moviesData);
    } catch (error) {
      console.error("Error loading home content:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const VideoCardSkeleton = () => (
    <div className="space-y-2">
      <Skeleton className="w-full aspect-video rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );

  const VideoCard = ({ video }: { video: Video }) => (
    <Link to={`/watch/${video.id}`} className="group">
      <div className="video-thumbnail relative">
        {video.thumbnail_url && (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        )}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>

        {/* Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center neon-btn-red">
            <svg
              className="w-8 h-8 ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Metadata Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent">
          <p className="text-white font-semibold text-sm truncate">
            {video.title}
          </p>
          <div className="flex items-center justify-between text-xs text-gray-300 mt-1">
            <span>{formatNumber(video.views)} views</span>
            <span>{formatNumber(video.likes)} likes</span>
          </div>
        </div>
      </div>
    </Link>
  );

  return (
    <Layout>
      {/* Hero Section */}
      <Hero
        title="Your Entertainment Starts Here"
        subtitle="Watch exclusive content, support creators, and earn MAI Coins"
        featured={true}
        ctaLink="/shorts"
      />

      {/* Featured Content Section */}
      <section className="section-padding bg-black/50">
        <div className="container-wide">
          <div className="mb-8 flex items-center gap-3">
            <Star className="text-yellow-400" size={28} />
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Featured Content
            </h2>
          </div>

          {isLoading ? (
            <div className="content-grid">
              {[...Array(4)].map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          ) : featuredVideos.length > 0 ? (
            <div className="content-grid">
              {featuredVideos.slice(0, 4).map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">No featured content available yet</p>
            </div>
          )}
        </div>
      </section>

      {/* Trending Shorts Section */}
      <section className="section-padding border-t border-white/10">
        <div className="container-wide">
          <div className="mb-8 flex items-center gap-3">
            <Flame className="text-red-500" size={28} />
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Trending Shorts
            </h2>
          </div>

          {isLoading ? (
            <div className="content-grid">
              {[...Array(6)].map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          ) : trendingShorts.length > 0 ? (
            <div className="content-grid">
              {trendingShorts.slice(0, 6).map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">No trending shorts yet</p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Movies Section */}
      <section className="section-padding border-t border-white/10">
        <div className="container-wide">
          <div className="mb-8 flex items-center gap-3">
            <Zap className="text-yellow-400" size={28} />
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Latest Movies
            </h2>
          </div>

          {isLoading ? (
            <div className="content-grid">
              {[...Array(4)].map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          ) : movies.length > 0 ? (
            <div className="content-grid">
              {movies.slice(0, 4).map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg">No movies available yet</p>
            </div>
          )}
        </div>
      </section>

      {/* Creator Signup CTA Section */}
      <section className="section-padding border-t border-white/10 bg-gradient-to-r from-black via-red-950/20 to-black">
        <div className="container-wide">
          <div className="max-w-2xl mx-auto text-center card-glow">
            <Upload className="mx-auto mb-4 text-yellow-400" size={40} />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Become a Creator
            </h2>
            <p className="text-gray-300 mb-8 text-lg">
              Share your content with millions, earn MAI Coins, and build your
              fan community. Start earning today!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/upload" className="neon-btn-red">
                Start Creating Now
              </Link>
              <Link to="/dashboard" className="neon-btn-gold">
                View Creator Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-padding border-t border-white/10 bg-black">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { label: "Total Videos", value: "2.5M+", icon: "📹" },
              { label: "Active Creators", value: "500K+", icon: "⭐" },
              { label: "Total Users", value: "100M+", icon: "👥" },
              { label: "Coins Distributed", value: "5B+", icon: "💰" },
            ].map((stat, index) => (
              <div key={index} className="card-glow text-center">
                <div className="text-4xl mb-2">{stat.icon}</div>
                <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
