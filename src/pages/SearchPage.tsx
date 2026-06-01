import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, User, Users, Shield, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  is_following: boolean;
  is_follower: boolean;
  is_admin: boolean;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filter, setFilter] = useState<'all' | 'following' | 'followers'>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = profile?.role === 'admin' || profile?.is_admin === true;

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const searchUsers = useCallback(async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const searchPattern = `%${trimmed}%`;

      // Admin can search all users; regular users search everyone but we mark follow relationships
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role, is_admin')
        .ilike('username', searchPattern)
        .neq('id', user?.id || '')
        .order('username', { ascending: true })
        .limit(30);

      if (error) throw error;

      // Check follow relationships for the current user
      const userIds = (users || []).map(u => u.id);
      let followingSet = new Set<string>();
      let followerSet = new Set<string>();

      if (user?.id && userIds.length > 0) {
        // Who does current user follow?
        const { data: following } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .in('following_id', userIds);

        // Who follows current user?
        const { data: followers } = await supabase
          .from('user_follows')
          .select('follower_id')
          .eq('following_id', user.id)
          .in('follower_id', userIds);

        followingSet = new Set((following || []).map(f => f.following_id));
        followerSet = new Set((followers || []).map(f => f.follower_id));
      }

      const mapped: SearchResult[] = (users || []).map(u => ({
        id: u.id,
        username: u.username || 'Unknown',
        avatar_url: u.avatar_url,
        role: u.role || 'user',
        is_following: followingSet.has(u.id),
        is_follower: followerSet.has(u.id),
        is_admin: u.is_admin === true,
      }));

      // Apply filter
      let filtered = mapped;
      if (filter === 'following') {
        filtered = mapped.filter(u => u.is_following);
      } else if (filter === 'followers') {
        filtered = mapped.filter(u => u.is_follower);
      }

      setResults(filtered);
    } catch (err) {
      console.error('[SearchPage] Search error:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, filter]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchUsers]);

  const handleSelect = (username: string) => {
    navigate(`/profile/${username}`);
  };

  return (
    <div className="flex h-dvh flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="shrink-0 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 pb-3">
          {([
            { key: 'all', label: 'All Users', icon: Users },
            { key: 'following', label: 'Following', icon: User },
            { key: 'followers', label: 'Followers', icon: Users },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                filter === f.key
                  ? 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/30'
                  : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'
              )}
            >
              <f.icon size={12} />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-sm text-slate-400">Search for users by username</p>
            <p className="mt-1 text-xs text-slate-600">
              {isAdmin ? 'Admin: search all users' : 'Find people you follow or who follow you'}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
          </div>
        )}

        {hasSearched && !isLoading && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <User className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-sm text-slate-400">No users found</p>
            <p className="mt-1 text-xs text-slate-600">Try a different search term</p>
          </div>
        )}

        {results.map((result) => (
          <button
            key={result.id}
            onClick={() => handleSelect(result.username)}
            className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5"
          >
            {result.avatar_url ? (
              <img
                src={result.avatar_url}
                alt={result.username}
                className="h-10 w-10 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-purple-600 to-pink-600">
                <User size={16} className="text-white" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{result.username}</p>
                {result.is_admin && (
                  <Shield className="h-3 w-3 shrink-0 text-yellow-400" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {result.is_following && (
                  <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                    Following
                  </span>
                )}
                {result.is_follower && (
                  <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">
                    Follows you
                  </span>
                )}
              </div>
            </div>

            <ArrowLeft size={16} className="shrink-0 rotate-180 text-slate-500" />
          </button>
        ))}
      </div>
    </div>
  );
}
