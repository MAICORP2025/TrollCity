import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Play, Coins, Eye, Heart } from 'lucide-react';

export default function ShortCard({ video }) {
  return (
    <Link 
      to={createPageUrl(`Watch?id=${video.id}`)}
      className="group relative block overflow-hidden rounded-2xl card-glow transition-all duration-500 aspect-[9/16]"
    >
      {/* Thumbnail */}
      <img 
        src={video.thumbnail_url || 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400'}
        alt={video.title}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
      
      {/* Play Button */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
        <div className="w-14 h-14 rounded-full bg-[#FF1744]/30 backdrop-blur-sm flex items-center justify-center border border-[#FF1744]/50 transform scale-50 group-hover:scale-100 transition-transform">
          <Play className="w-7 h-7 text-[#FF1744] fill-[#FF1744]" />
        </div>
      </div>
      
      {/* Premium Badge */}
      {video.is_premium && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-[#FFD700]/20 backdrop-blur-sm border border-[#FFD700]/50">
          <Coins className="w-3 h-3 text-[#FFD700]" />
          <span className="text-xs font-semibold text-[#FFD700]">{video.coin_price}</span>
        </div>
      )}
      
      {/* Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="font-semibold text-white line-clamp-2 mb-2 text-sm">
          {video.title}
        </h3>
        <div className="flex items-center gap-4 text-xs text-gray-300">
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            <span>{video.views || 0}</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="w-3 h-3" />
            <span>{video.likes || 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}