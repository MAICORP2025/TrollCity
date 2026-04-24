import { useState, useEffect, useRef, memo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { cn } from '../../lib/utils';
import { User, MoreHorizontal } from 'lucide-react';

interface Viewer {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface ViewerBubblesProps {
  streamId: string;
  maxVisible?: number;
  className?: string;
}

function ViewerBubbles({ streamId, maxVisible = 6, className }: ViewerBubblesProps) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`viewer_bubbles_${streamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stream_participants',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newViewer = payload.new as any;
            setViewers((prev) => {
              if (prev.some((v) => v.id === newViewer.user_id)) return prev;
              return [...prev, { id: newViewer.user_id, username: newViewer.username, avatar_url: newViewer.avatar_url }];
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedViewer = payload.old as any;
            setViewers((prev) => prev.filter((v) => v.id !== deletedViewer.user_id));
          }
        }
      )
      .subscribe();

    // Also fetch initial viewers
    const fetchViewers = async () => {
      const { data } = await supabase
        .from('stream_participants')
        .select('user_id, username, user:user_profiles(avatar_url)')
        .eq('stream_id', streamId)
        .limit(50);

      if (data) {
        setViewers(data.map((d) => ({
          id: d.user_id,
          username: d.username,
          avatar_url: d.user?.avatar_url || null,
        })));
      }
    };

    fetchViewers();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const visibleViewers = viewers.slice(0, maxVisible);
  const remainingCount = Math.max(0, viewers.length - maxVisible);

  if (viewers.length === 0) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        'flex items-center gap-1 overflow-visible',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Viewer bubbles */}
      <div className="flex items-center -space-x-2">
        {visibleViewers.map((viewer, index) => (
          <div
            key={viewer.id}
            className={cn(
              'relative rounded-full border-2 border-black overflow-hidden transition-all duration-200 hover:scale-110 hover:z-10 hover:-translate-y-1',
              isHovered && 'opacity-80'
            )}
            title={viewer.username}
          >
            {viewer.avatar_url ? (
              <img
                src={viewer.avatar_url}
                alt={viewer.username}
                className="w-8 h-8 rounded-full object-cover bg-zinc-800"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                <User size={12} className="text-zinc-400" />
              </div>
            )}
            {/* Active indicator dot */}
            <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-black" />
          </div>
        ))}
      </div>

      {/* More viewers indicator */}
      {remainingCount > 0 && (
        <div className="flex items-center gap-1 ml-1">
          <div className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-black flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">+{remainingCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ViewerBubbles);
