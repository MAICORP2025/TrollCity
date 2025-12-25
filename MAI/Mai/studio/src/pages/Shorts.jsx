import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Play, Filter, TrendingUp, Clock, Flame } from 'lucide-react';
import ShortCard from '../components/video/ShortCard';
import { sampleShorts } from '@/data/sampleVideos';

const Shorts = () => {
  const [sortBy, setSortBy] = useState('trending');
  const [category, setCategory] = useState('all');

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'comedy', label: 'Comedy' },
    { value: 'music', label: 'Music' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'lifestyle', label: 'Lifestyle' },
    { value: 'education', label: 'Education' },
  ];

  const { data: shorts = [], isLoading } = useQuery({
    queryKey: ['shorts', sortBy, category],
    queryFn: async () => {
      try {
        let query = supabase
          .from('videos')
          .select('*')
          .eq('status', 'approved')
          .eq('content_type', 'short');

        if (category !== 'all') {
          query = query.eq('category', category);
        }

        const sortField = sortBy === 'trending' ? 'views' : 'created_at';
        query = query.order(sortField, { ascending: sortBy === 'latest' });

        const { data, error } = await query.limit(50);
        if (error) throw error;
        
        if (data && data.length > 0) {
          return data;
        }
        
        let filtered = sampleShorts;
        if (category !== 'all') {
          filtered = filtered.filter(s => s.category === category);
        }
        
        if (sortBy === 'trending') {
          filtered = filtered.sort((a, b) => b.views - a.views);
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
        return filtered;
      } catch {
        let filtered = sampleShorts;
        if (category !== 'all') {
          filtered = filtered.filter(s => s.category === category);
        }
        
        if (sortBy === 'trending') {
          filtered = filtered.sort((a, b) => b.views - a.views);
        } else {
          filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
        return filtered;
      }
    },
  });

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-[#FF1744]/20">
                <Flame className="w-6 h-6 text-[#FF1744]" />
              </div>
              <h1 className="text-3xl font-bold text-white">Shorts</h1>
            </div>
            <p className="text-gray-400">Quick, entertaining content from our creators</p>
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy('trending')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'trending'
                  ? 'bg-[#FF1744] text-white shadow-lg shadow-[#FF1744]/25'
                  : 'border border-gray-700 text-gray-400 hover:text-white hover:border-[#FF1744]'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Trending
            </button>
            <button
              onClick={() => setSortBy('latest')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                sortBy === 'latest'
                  ? 'bg-[#FF1744] text-white shadow-lg shadow-[#FF1744]/25'
                  : 'border border-gray-700 text-gray-400 hover:text-white hover:border-[#FF1744]'
              }`}
            >
              <Clock className="w-4 h-4" />
              Latest
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
                    ? 'bg-[#FF1744]/20 border border-[#FF1744] text-[#FF1744]'
                    : 'border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Shorts Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[9/16] rounded-xl bg-gray-800/50 animate-pulse" />
            ))}
          </div>
        ) : shorts.length === 0 ? (
          <div className="text-center py-20">
            <Play className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No shorts found</h3>
            <p className="text-gray-500">Check back later for new content</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {shorts.map((video) => (
              <ShortCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Shorts;