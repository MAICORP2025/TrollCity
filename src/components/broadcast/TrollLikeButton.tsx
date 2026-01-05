import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface TrollLikeButtonProps {
  streamId: string;
  currentLikes: number;
  onLike?: () => void;
}

export default function TrollLikeButton({ streamId, currentLikes, onLike }: TrollLikeButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleLike = async () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1000);

    try {
      // 1. Update stream likes
      const { error } = await supabase.rpc('increment_stream_likes', { stream_id: streamId });
      
      // If RPC doesn't exist, fallback to direct update (less safe for concurrency but works)
      if (error) {
        // Fallback: fetch current, increment, update
        const { data: stream } = await supabase.from('streams').select('total_likes').eq('id', streamId).single();
        if (stream) {
          await supabase.from('streams').update({ total_likes: (stream.total_likes || 0) + 1 }).eq('id', streamId);
        }
      }

      // 2. Send "like" message for real-time visibility
      await supabase.from('messages').insert({
        stream_id: streamId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        message_type: 'system', // Use system as 'like' isn't standard
        content: 'ACTION:LIKE'
      });

      onLike?.();
    } catch (e) {
      console.error('Failed to like stream', e);
      toast.error('Failed to send like');
    }
  };

  return (
    <button
      onClick={handleLike}
      className={`relative group p-3 rounded-full bg-white/10 hover:bg-pink-500/20 transition-all ${isAnimating ? 'scale-125' : 'scale-100'}`}
    >
      <Heart
        className={`w-6 h-6 transition-colors ${isAnimating ? 'text-pink-500 fill-pink-500' : 'text-white group-hover:text-pink-400'}`}
      />
      {isAnimating && (
        <div className="absolute inset-0 pointer-events-none">
           <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full text-2xl animate-bounce">
             🧟
           </span>
        </div>
      )}
    </button>
  );
}
