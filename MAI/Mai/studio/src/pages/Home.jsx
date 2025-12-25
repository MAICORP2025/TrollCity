import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Film, Sparkles, ChevronRight, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VideoCard from '../components/video/VideoCard';
import ShortCard from '../components/video/ShortCard';
import { sampleVideos, sampleShorts } from '@/data/sampleVideos';

export default function Home() {
  const { data: featuredVideos = [], isLoading: loadingFeatured } = useQuery({
    queryKey: ['featured-videos'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'approved')
          .eq('featured', true)
          .order('created_at', { ascending: false })
          .limit(6);
        if (error) throw error;
        return data && data.length > 0 ? data : sampleVideos.slice(0, 6);
      } catch {
        return sampleVideos.slice(0, 6);
      }
    },
  });

  const { data: trendingShorts = [], isLoading: loadingShorts } = useQuery({
    queryKey: ['trending-shorts'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'approved')
          .eq('content_type', 'short')
          .order('views', { ascending: false })
          .limit(8);
        if (error) throw error;
        return data && data.length > 0 ? data : sampleShorts;
      } catch {
        return sampleShorts;
      }
    },
  });

  const { data: latestMovies = [], isLoading: loadingMovies } = useQuery({
    queryKey: ['latest-movies'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'approved')
          .eq('content_type', 'movie')
          .order('created_at', { ascending: false })
          .limit(6);
        if (error) throw error;
        return data && data.length > 0 ? data : sampleVideos.slice(0, 6);
      } catch {
        return sampleVideos.slice(0, 6);
      }
    },
  });

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative h-[70vh] overflow-hidden bg-black">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1920"
            alt="Hero"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        </div>
        
        <div className="relative z-10 h-full max-w-7xl mx-auto px-4 flex flex-col justify-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-[#FFD700]" />
              <span className="text-[#FFD700] font-medium tracking-wider">WELCOME TO</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-4">
              <span className="neon-gold">MAI</span>{' '}
              <span className="neon-red">Studios</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed">
              The next generation streaming platform. Watch exclusive shorts and movies, 
              support your favorite creators with MAI Coins.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to={createPageUrl('Shorts')}>
                <Button className="neon-btn-red text-white px-8 py-6 text-lg font-semibold">
                  <Flame className="w-5 h-5 mr-2" />
                  Watch Shorts
                </Button>
              </Link>
              <Link to={createPageUrl('Movies')}>
                <Button variant="outline" className="border-[#FFD700] text-[#FFD700] hover:bg-[#FFD700]/10 px-8 py-6 text-lg font-semibold">
                  <Film className="w-5 h-5 mr-2" />
                  Browse Movies
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Content */}
      <section className="py-16 px-4 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-[#FFD700] rounded-full" />
              <h2 className="text-2xl md:text-3xl font-bold text-white">Featured Content</h2>
            </div>
            <Link to={createPageUrl('Movies')} className="flex items-center gap-1 text-[#FFD700] hover:underline">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loadingFeatured ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-video rounded-xl bg-gray-800/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredVideos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trending Shorts */}
      <section className="py-16 px-4 bg-black bg-gradient-to-b from-transparent via-[#FF1744]/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-[#FF1744] rounded-full" />
              <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-[#FF1744]" />
                Trending Shorts
              </h2>
            </div>
            <Link to={createPageUrl('Shorts')} className="flex items-center gap-1 text-[#FF1744] hover:underline">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loadingShorts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[9/16] rounded-xl bg-gray-800/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {trendingShorts.map((video) => (
                <ShortCard key={video.id} video={video} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Latest Movies */}
      <section className="py-16 px-4 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-1 h-8 bg-[#FFD700] rounded-full" />
              <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Film className="w-6 h-6 text-[#FFD700]" />
                Latest Movies
              </h2>
            </div>
            <Link to={createPageUrl('Movies')} className="flex items-center gap-1 text-[#FFD700] hover:underline">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loadingMovies ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-video rounded-xl bg-gray-800/50 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestMovies.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-black">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 rounded-3xl border border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent">
            <Sparkles className="w-12 h-12 text-[#FFD700] mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Create?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Join MAI Studios as a creator and start earning MAI Coins from your content. 
              Cash out your earnings every Monday and Friday.
            </p>
            <Link to={createPageUrl('BecomeCreator')}>
              <Button className="neon-btn-gold text-black px-10 py-6 text-lg font-semibold">
                Apply to Become a Creator
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}