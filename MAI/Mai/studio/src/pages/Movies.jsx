import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Film, TrendingUp, Clock, Star, Search } from 'lucide-react';
import VideoCard from '../components/video/VideoCard';
import { sampleVideos } from '@/data/sampleVideos';

const Movies = () => {
  const [sortBy, setSortBy] = useState('latest');
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'action', label: 'Action' },
    { value: 'comedy', label: 'Comedy' },
    { value: 'drama', label: 'Drama' },
    { value: 'horror', label: 'Horror' },
    { value: 'documentary', label: 'Documentary' },
  ];

  const { data: movies = [], isLoading } = useQuery({
    queryKey: ['movies', sortBy, category],
    queryFn: async () => {
      try {
        let query = supabase
          .from('videos')
          .select('*')
          .eq('status', 'approved')
          .eq('content_type', 'movie');

        if (category !== 'all') {
          query = query.eq('category', category);
        }

        let sortField, ascending;
        if (sortBy === 'trending') {
          sortField = 'views';
          ascending = false;
        } else if (sortBy === 'top') {
          sortField = 'likes';
          ascending = false;
        } else {
          sortField = 'created_at';
          ascending = false;
        }

        query = query.order(sortField, { ascending });

        const { data, error } = await query.limit(50);
        if (error) throw error;
        
        if (data && data.length > 0) {
          return data;
        }
        
        let filtered = sampleVideos;
        if (category !== 'all') {
          filtered = filtered.filter(v => v.category === category);
        }
        
        if (sortBy === 'trending') {
          filtered = filtered.sort((a, b) => b.views - a.views);
        } else if (sortBy === 'top') {
          filtered = filtered.sort((a, b) => b.likes - a.likes);
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
        return filtered;
      } catch {
        let filtered = sampleVideos;
        if (category !== 'all') {
          filtered = filtered.filter(v => v.category === category);
        }
        
        if (sortBy === 'trending') {
          filtered = filtered.sort((a, b) => b.views - a.views);
        } else if (sortBy === 'top') {
          filtered = filtered.sort((a, b) => b.likes - a.likes);
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
        return filtered;
      }
    },
  });

  const filteredMovies = movies.filter(movie =>
    movie.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    movie.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#FFD700]/20">
                <Film className="w-6 h-6 text-[#FFD700]" />
              </div>
              <h1 className="text-3xl font-bold text-white">Movies</h1>
            </div>
            <p className="text-gray-400">Full-length films from talented creators</p>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:border-[#FFD700] focus:outline-none"
            />
          </div>
        </div>

        {/* Sort & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          {/* Sort Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy('latest')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'latest'
                  ? 'bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/25'
                  : 'border border-gray-700 text-gray-400 hover:text-white hover:border-[#FFD700]'
              }`}
            >
              <Clock className="w-4 h-4" />
              Latest
            </button>
            <button
              onClick={() => setSortBy('trending')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'trending'
                  ? 'bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/25'
                  : 'border border-gray-700 text-gray-400 hover:text-white hover:border-[#FFD700]'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Trending
            </button>
            <button
              onClick={() => setSortBy('top')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'top'
                  ? 'bg-[#FFD700] text-black shadow-lg shadow-[#FFD700]/25'
                  : 'border border-gray-700 text-gray-400 hover:text-white hover:border-[#FFD700]'
              }`}
            >
              <Star className="w-4 h-4" />
              Top Rated
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8 overflow-x-auto pb-2">
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  category === cat.value
                    ? 'bg-[#FFD700]/20 border border-[#FFD700] text-[#FFD700]'
                    : 'border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Movies Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-video rounded-xl bg-gray-800/50 animate-pulse" />
            ))}
          </div>
        ) : filteredMovies.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No movies found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMovies.map((movie) => (
              <VideoCard key={movie.id} video={movie} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Movies;