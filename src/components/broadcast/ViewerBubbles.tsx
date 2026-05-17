import { useState, useEffect, useRef, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  viewers?: Viewer[];
}

function ViewerBubbles({ streamId, maxVisible = 10, className, viewers: viewerOverride }: ViewerBubblesProps) {
  const [fallbackViewers, setFallbackViewers] = useState<Viewer[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streamId) return;
    if (viewerOverride) return;

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
            setFallbackViewers((prev) => {
              if (prev.some((v) => v.id === newViewer.user_id)) return prev;
              return [...prev, { id: newViewer.user_id, username: newViewer.username, avatar_url: newViewer.avatar_url }];
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedViewer = payload.old as any;
            setFallbackViewers((prev) => prev.filter((v) => v.id !== deletedViewer.user_id));
          }
        }
      )
      .subscribe();

    // Also fetch initial viewers
    const fetchViewers = async () => {
      const { data } = await supabase
        .from('stream_viewers')
        .select('user_id, last_seen, user:user_profiles(username, display_name, email, avatar_url)')
        .eq('stream_id', streamId)
        .gte('last_seen', new Date(Date.now() - 90_000).toISOString())
        .limit(50);

      if (data) {
        setFallbackViewers(data.map((d: any) => {
          const profile = Array.isArray(d.user) ? d.user[0] : d.user;
          return ({
          id: d.user_id,
          username: profile?.username || profile?.display_name || profile?.email?.split('@')?.[0] || 'Troll Citizen',
          avatar_url: profile?.avatar_url || null,
        });
        }));
      }
    };

    fetchViewers();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, viewerOverride]);

  const viewers = viewerOverride || fallbackViewers;
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
        <AnimatePresence initial={false}>
        {visibleViewers.map((viewer) => (
          <motion.div
            key={viewer.id}
            initial={{ opacity: 0, scale: 0.35, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.35, y: -14, filter: 'blur(2px)' }}
            transition={{ duration: 0.22 }}
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
          </motion.div>
        ))}
        </AnimatePresence>
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
