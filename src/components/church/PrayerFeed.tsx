
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { Heart, Trash2, Send, MessageCircle, AlertTriangle, Loader2, Gavel } from 'lucide-react';
import { toast } from 'sonner';

interface Prayer {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  user_profiles: {
    username: string;
    avatar_url: string;
    role: string;
    is_pastor: boolean;
  };
  has_liked?: boolean;
}

export default function PrayerFeed({ isOpen }: { isOpen: boolean }) {
  const { profile } = useAuthStore();
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [newPrayer, setNewPrayer] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Check if user is pastor or admin
  const isPastorOrAdmin = profile?.is_pastor || profile?.role === 'admin' || (profile as any)?.is_admin;

  useEffect(() => {
    fetchPrayers();

    // Poll every 30 seconds instead of Realtime subscription
    const interval = setInterval(() => {
      fetchPrayers();
    }, 30000);

    return () => {
      clearInterval(interval);
      supabase.channel('church_prayers_channel').unsubscribe();
    };
  }, [profile?.id]);

  const fetchPrayers = async () => {
    try {
      const { data, error } = await supabase
        .from('church_prayers')
        .select(`
          *,
          user_profiles:user_id (username, avatar_url, role, is_pastor)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Check likes for current user
      let prayersWithLikes = data || [];
      if (profile) {
        const { data: likes } = await supabase
          .from('church_prayer_likes')
          .select('prayer_id')
          .eq('user_id', profile.id);
        
        const likedIds = new Set(likes?.map(l => l.prayer_id));
        prayersWithLikes = prayersWithLikes.map(p => ({
          ...p,
          has_liked: likedIds.has(p.id)
        }));
      }

      setPrayers(prayersWithLikes);
    } catch (err) {
      console.error('Error fetching prayers:', err);
    } finally {
      setLoading(false);
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrayer.trim() || !isOpen) return;
    
    setSending(true);
    try {
      const { error } = await supabase
        .from('church_prayers')
        .insert({
          user_id: profile?.id,
          content: newPrayer.trim()
        });

      if (error) throw error;
      
      setNewPrayer('');
      toast.success('Prayer posted successfully');
      
      // Award badge logic could go here or be a trigger
      checkChurchBadge();
      
    } catch (err) {
      toast.error('Failed to post prayer');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const checkChurchBadge = async () => {
    if (!profile) return;
    // Simple check: Insert badge if not exists
    await supabase.from('user_badges').insert({
        user_id: profile.id,
        badge_id: (await supabase.from('badge_catalog').select('id').eq('slug', 'church_attendee').single()).data?.id
    }).maybeSingle(); // Ignore if duplicate
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prayer?')) return;
    try {
      await supabase.from('church_prayers').delete().eq('id', id);
      toast.success('Prayer deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleKick = async (userId: string, username: string) => {
    // This is a placeholder for the kick functionality.
    // In a real implementation, you might want to call a backend API or open a modal.
    toast.info(`Kicking ${username}... (Feature coming soon)`);
  };

  const handleLike = async (prayer: Prayer) => {
     if (!profile) return;
     
     // Optimistic update
     setPrayers(prev => prev.map(p => {
        if (p.id === prayer.id) {
           return {
              ...p,
              likes_count: p.has_liked ? p.likes_count - 1 : p.likes_count + 1,
              has_liked: !p.has_liked
           };
        }
        return p;
     }));

     try {
       if (prayer.has_liked) {
          await supabase.from('church_prayer_likes').delete().eq('prayer_id', prayer.id).eq('user_id', profile.id);
       } else {
          await supabase.from('church_prayer_likes').insert({ prayer_id: prayer.id, user_id: profile.id });
       }
     } catch (err) {
       // Revert on error (fetching again is easiest)
       fetchPrayers();
     }
  };

  return (
    <div className="space-y-6">
       {/* Input Section */}
       <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
          <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
             <MessageCircle size={20} className="text-purple-400" />
             Share Your Prayer
          </h3>
          
          {isOpen ? (
            <form onSubmit={handleSubmit} className="space-y-3">
               <textarea
                 value={newPrayer}
                 onChange={e => setNewPrayer(e.target.value)}
                 placeholder="Write your prayer or reflection here..."
                 className="w-full bg-black/40 border border-zinc-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 min-h-[100px]"
                 maxLength={500}
               />
               <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{newPrayer.length}/500</span>
                  <button
                    type="submit"
                    disabled={sending || !newPrayer.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium flex items-center gap-2 transition-all"
                  >
                    {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    Post Prayer
                  </button>
               </div>
            </form>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-500/20 rounded-lg text-red-200">
               <AlertTriangle size={20} />
               <p className="text-sm">Prayers can only be posted during church hours (1 PM - 3 PM).</p>
            </div>
          )}
       </div>

       {/* Feed */}
       <div className="space-y-4">
          {prayers.map(prayer => (
             <div key={prayer.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div className="flex justify-between items-start mb-3">
                   <div className="flex items-center gap-3">
                      <img 
                        src={prayer.user_profiles?.avatar_url || `https://ui-avatars.com/api/?name=${prayer.user_profiles?.username || 'User'}`} 
                        alt={prayer.user_profiles?.username}
                        className="w-10 h-10 rounded-full border border-zinc-700"
                      />
                      <div>
                         <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{prayer.user_profiles?.username}</span>
                            {prayer.user_profiles?.is_pastor && (
                               <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold rounded uppercase">
                                  Pastor
                               </span>
                            )}
                         </div>
                         <span className="text-xs text-gray-500">{new Date(prayer.created_at).toLocaleString()}</span>
                      </div>
                   </div>
                   
                   {(isPastorOrAdmin || prayer.user_id === profile?.id) && (
                      <div className="flex gap-1">
                        {isPastorOrAdmin && prayer.user_id !== profile?.id && (
                          <button 
                            onClick={() => handleKick(prayer.user_id, prayer.user_profiles?.username)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                            title="Kick from Church & Summon to Court"
                          >
                             <Gavel size={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(prayer.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        >
                           <Trash2 size={16} />
                        </button>
                      </div>
                   )}
                </div>
                
                <p className="text-gray-200 text-sm leading-relaxed mb-4 whitespace-pre-wrap">
                   {prayer.content}
                </p>
                
                <div className="flex items-center gap-4 pt-3 border-t border-zinc-800">
                   <button 
                     onClick={() => handleLike(prayer)}
                     className={`flex items-center gap-1.5 text-sm transition-colors ${prayer.has_liked ? 'text-pink-500' : 'text-gray-500 hover:text-pink-400'}`}
                   >
                      <Heart size={16} className={prayer.has_liked ? 'fill-current' : ''} />
                      <span>{prayer.likes_count}</span>
                   </button>
                   
                   {/* Reply button only for pastors? The prompt says "Only pastor(s) can reply" */}
                   {isPastorOrAdmin && (
                      <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white">
                         <MessageCircle size={16} />
                         <span>Reply</span>
                      </button>
                   )}
                </div>
             </div>
          ))}
          
          {prayers.length === 0 && !loading && (
             <div className="text-center py-12 text-gray-500">
                <p>No prayers yet. Be the first to share.</p>
             </div>
          )}
       </div>
    </div>
  );
}
