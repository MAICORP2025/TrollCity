import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { fetchVideoById, fetchTrendingShorts, Video } from '@/lib/supabaseClient';
import { formatNumber, formatRelativeTime } from '@/utils/index';
import { Skeleton } from '@/components/ui/skeleton';
import { ThumbsUp, Share2, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    loadVideo();
  }, [id]);

  const loadVideo = async () => {
    try {
      setIsLoading(true);
      if (!id) throw new Error('Invalid video ID');
      const videoData = await fetchVideoById(id);
      setVideo(videoData);

      const related = await fetchTrendingShorts();
      setRelatedVideos(related.filter((v) => v.id !== id).slice(0, 6));
    } catch (error) {
      console.error('Error loading video:', error);
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="section-padding bg-black">
          <div className="container-wide">
            <Skeleton className="w-full aspect-video rounded-lg mb-8" />
            <Skeleton className="h-8 w-1/2 mb-4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!video) {
    return (
      <Layout>
        <div className="section-padding bg-black">
          <div className="container-wide text-center">
            <p className="text-gray-400 text-lg">Video not found</p>
            <Link to="/" className="text-yellow-400 hover:text-yellow-300 mt-4">
              Back to Home
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="section-padding bg-black">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Video */}
            <div className="lg:col-span-2">
              {/* Video Player */}
              <div className="video-thumbnail relative rounded-lg overflow-hidden mb-6">
                <video
                  src={video.video_url}
                  controls
                  className="w-full aspect-video bg-black"
                />
              </div>

              {/* Video Info */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-4">
                  {video.title}
                </h1>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-yellow-400 to-red-500 flex items-center justify-center">
                      <span className="text-black font-bold">CR</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">Creator Name</p>
                      <p className="text-gray-400 text-sm">
                        {formatRelativeTime(video.created_at)}
                      </p>
                    </div>
                  </div>

                  <Button
                    className="neon-btn-red h-10"
                  >
                    Subscribe
                  </Button>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap items-center gap-6 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{formatNumber(video.views)}</span>
                    <span className="text-gray-500">views</span>
                  </div>
                  <button
                    onClick={() => setIsLiked(!isLiked)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                      isLiked
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    <ThumbsUp size={18} />
                    {formatNumber(video.likes + (isLiked ? 1 : 0))}
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-gray-400 hover:bg-white/20 transition">
                    <Share2 size={18} />
                    Share
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-gray-400 hover:bg-white/20 transition">
                    <Flag size={18} />
                    Report
                  </button>
                </div>

                {/* Description */}
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-gray-300">
                    {video.description || 'No description provided'}
                  </p>
                </div>
              </div>
            </div>

            {/* Related Videos Sidebar */}
            <div>
              <h3 className="text-white font-bold text-lg mb-4">Up Next</h3>
              <div className="space-y-3">
                {relatedVideos.map((relatedVideo) => (
                  <Link
                    key={relatedVideo.id}
                    to={`/watch/${relatedVideo.id}`}
                    className="group flex gap-3 p-2 rounded-lg hover:bg-white/5 transition"
                  >
                    <div className="w-24 h-16 rounded flex-shrink-0 overflow-hidden">
                      {relatedVideo.thumbnail_url && (
                        <img
                          src={relatedVideo.thumbnail_url}
                          alt={relatedVideo.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm line-clamp-2 group-hover:text-yellow-400 transition">
                        {relatedVideo.title}
                      </p>
                      <p className="text-gray-400 text-xs mt-1">
                        {formatNumber(relatedVideo.views)} views
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
