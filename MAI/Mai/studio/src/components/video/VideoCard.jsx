import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Play, Coins, Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VideoCard({ video, variant = 'default' }) {
  const isShort = video.content_type === 'short';
  
  return (
    <Link 
      to={createPageUrl(`Watch?id=${video.id}`)}
      className={cn(
        "group relative block overflow-hidden rounded-xl card-glow transition-all duration-500",
        variant === 'featured' && "col-span-2 row-span-2"
      )}
    >
      {/* Thumbnail */}
      <div className={cn(
        "relative overflow-hidden",
        isShort ? "aspect-[9/16]" : "aspect-video"
      )}>
        <img 
          src={video.thumbnail_url || 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800'}
          alt={video.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />
        
        {/* Play Button */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-16 h-16 rounded-full bg-[#FFD700]/20 backdrop-blur-sm flex items-center justify-center border border-[#FFD700]/50 transform scale-50 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-8 h-8 text-[#FFD700] fill-[#FFD700]" />
          </div>
        </div>
        
        {/* Premium Badge */}
        {video.is_premium && (
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-[#FFD700]/20 backdrop-blur-sm border border-[#FFD700]/50">
            <Coins className="w-3 h-3 text-[#FFD700]" />
            <span className="text-xs font-semibold text-[#FFD700]">{video.coin_price}</span>
          </div>
        )}
        
        {/* Duration */}
        {video.duration_minutes && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded bg-black/70 text-xs text-white">
            <Clock className="w-3 h-3" />
            <span>{video.duration_minutes} min</span>
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-white group-hover:text-[#FFD700] transition-colors line-clamp-2 mb-2">
          {video.title}
        </h3>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <Link 
            to={createPageUrl(`UserProfile?user=${video.creator_email}`)}
            className="hover:text-[#FFD700] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {video.creator_name || 'Unknown'}
          </Link>
          <div className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            <span>{video.views || 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}