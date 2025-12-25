import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { fetchMovies, Video } from '@/lib/supabaseClient';
import { formatNumber } from '@/utils/index';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap } from 'lucide-react';

export default function Movies() {
  const [movies, setMovies] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMovies();
  }, []);

  const loadMovies = async () => {
    try {
      setIsLoading(true);
      const data = await fetchMovies();
      setMovies(data);
    } catch (error) {
      console.error('Error loading movies:', error);
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
      <div className="video-thumbnail relative overflow-hidden rounded-lg">
        {video.thumbnail_url && (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        )}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center neon-btn-gold">
            <svg
              className="w-8 h-8 ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

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
      <section className="section-padding bg-black/50">
        <div className="container-wide">
          <div className="mb-8 flex items-center gap-3">
            <Zap className="text-yellow-400" size={28} />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Movies
            </h1>
          </div>
          <p className="text-gray-400 text-lg mb-12">
            Discover the latest and greatest movies on MAI Studios
          </p>

          {isLoading ? (
            <div className="content-grid">
              {[...Array(8)].map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          ) : movies.length > 0 ? (
            <div className="content-grid">
              {movies.map((movie) => (
                <VideoCard key={movie.id} video={movie} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No movies available yet</p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
