import React, { useState, useEffect } from 'react';
import { useBroadcastLockdown } from '../../../lib/hooks/useBroadcastLockdown';
import { supabase } from '../../../lib/supabase';
import { 
  ShieldAlert, ShieldCheck, Search, Lock, Unlock, 
  BadgeCheck, Save, RefreshCw, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { toast } from 'sonner';

export default function BroadcastLockTab() {
  const { settings, maxBroadcasters, loading: hookLoading, updateSettings, updateMaxBroadcasters } = useBroadcastLockdown();
  
  // Local state for table
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [broadcasterCount, setBroadcasterCount] = useState(0);
  const [newLimit, setNewLimit] = useState(maxBroadcasters);

  useEffect(() => {
    setNewLimit(maxBroadcasters);
  }, [maxBroadcasters]);

  const loadUsers = React.useCallback(async () => {
    setLoadingUsers(true);
    try {
      let query = supabase
        .from('user_profiles')
        .select('id, username, avatar_url, role, is_broadcast_locked, has_broadcast_badge', { count: 'exact' });

      if (search) {
        query = query.ilike('username', `%${search}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(page * 20, (page + 1) * 20 - 1);

      if (error) throw error;
      setUsers(data || []);
      
      // Get total badge count
      const { count: badgeCount } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('has_broadcast_badge', true);
        
      setBroadcasterCount(badgeCount || 0);

    } catch (err: any) {
      console.error('Error loading users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleLockdown = async () => {
    await updateSettings({
      ...settings,
      enabled: !settings.enabled,
      admin_broadcast_room: settings.admin_broadcast_room || null
    });
  };

  const handleUpdateLimit = async () => {
    await updateMaxBroadcasters(newLimit);
  };

  const toggleUserLock = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_broadcast_locked: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, is_broadcast_locked: !currentStatus } : u));
      toast.success(`User ${!currentStatus ? 'locked' : 'unlocked'}`);
    } catch {
      toast.error('Failed to update user lock');
    }
  };

  const toggleUserBadge = async (userId: string, currentStatus: boolean) => {
    try {
        // If granting, check limit locally first for better UX (though RPC checks too if we used it)
        if (!currentStatus && broadcasterCount >= maxBroadcasters) {
            // Warn but allow admin to override? Or strictly enforce?
            // Admin should be able to override, but let's warn.
            toast.warning('Broadcaster limit reached! Increasing count beyond limit.');
        }

      const { error } = await supabase
        .from('user_profiles')
        .update({ has_broadcast_badge: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      
      setUsers(users.map(u => u.id === userId ? { ...u, has_broadcast_badge: !currentStatus } : u));
      setBroadcasterCount(prev => !currentStatus ? prev + 1 : prev - 1);
      toast.success(`Badge ${!currentStatus ? 'granted' : 'removed'}`);
    } catch {
      toast.error('Failed to update badge');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Global Lockdown Panel */}
        <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
                {settings.enabled ? (
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                ) : (
                    <ShieldCheck className="w-8 h-8 text-green-500" />
                )}
                <div>
                    <h2 className="text-xl font-bold text-white">Global Broadcast Lock</h2>
                    <p className="text-sm text-gray-400">
                        {settings.enabled ? 'Only admins can broadcast.' : 'Authorized users can broadcast.'}
                    </p>
                </div>
            </div>
            
            <button
                onClick={handleToggleLockdown}
                disabled={hookLoading}
                className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
                    settings.enabled 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
            >
                {settings.enabled ? 'Disable Lockdown' : 'Enable Lockdown'}
            </button>
        </div>

        {/* Broadcaster Limit Panel */}
        <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
                <BadgeCheck className="w-8 h-8 text-purple-500" />
                <div>
                    <h2 className="text-xl font-bold text-white">Broadcaster Limit</h2>
                    <p className="text-sm text-gray-400">
                        Current: <span className="text-purple-400 font-bold">{broadcasterCount}</span> / {maxBroadcasters} Badges
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <input 
                    type="number" 
                    value={newLimit}
                    onChange={(e) => setNewLimit(parseInt(e.target.value))}
                    className="flex-1 bg-black border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <button
                    onClick={handleUpdateLimit}
                    disabled={hookLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
                >
                    <Save className="w-4 h-4" /> Save
                </button>
            </div>
            <div className="w-full bg-slate-800 h-2 mt-4 rounded-full overflow-hidden">
                <div 
                    className="bg-purple-500 h-full transition-all duration-500"
                    style={{ width: `${Math.min((broadcasterCount / maxBroadcasters) * 100, 100)}%` }}
                />
            </div>
        </div>
      </div>

      {/* User Management Table */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-400" />
                Manage Broadcasters
            </h3>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                    placeholder="Search username..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-black border border-slate-600 rounded-lg px-4 py-2 text-white text-sm w-full md:w-64"
                />
                <button 
                    onClick={() => loadUsers()}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white"
                >
                    <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-slate-800 text-gray-200 uppercase font-bold">
                    <tr>
                        <th className="px-6 py-3">User</th>
                        <th className="px-6 py-3">Role</th>
                        <th className="px-6 py-3 text-center">Badge</th>
                        <th className="px-6 py-3 text-center">Lock Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                    {users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <img 
                                    src={user.avatar_url || 'https://via.placeholder.com/40'} 
                                    className="w-8 h-8 rounded-full bg-slate-700"
                                    alt={user.username}
                                />
                                <span className="font-medium text-white">{user.username}</span>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    user.role === 'admin' ? 'bg-red-900/50 text-red-400' : 'bg-slate-700 text-gray-300'
                                }`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button
                                    onClick={() => toggleUserBadge(user.id, user.has_broadcast_badge)}
                                    className={`p-2 rounded-lg transition-colors ${
                                        user.has_broadcast_badge 
                                        ? 'bg-purple-900/30 text-purple-400 hover:bg-purple-900/50' 
                                        : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                                    }`}
                                    title={user.has_broadcast_badge ? "Revoke Badge" : "Grant Badge"}
                                >
                                    {user.has_broadcast_badge ? <BadgeCheck className="w-5 h-5" /> : <BadgeCheck className="w-5 h-5 opacity-50" />}
                                </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <button
                                    onClick={() => toggleUserLock(user.id, user.is_broadcast_locked)}
                                    className={`p-2 rounded-lg transition-colors ${
                                        user.is_broadcast_locked 
                                        ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' 
                                        : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                                    }`}
                                    title={user.is_broadcast_locked ? "Unlock User" : "Lock User"}
                                >
                                    {user.is_broadcast_locked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                                </button>
                            </td>
                        </tr>
                    ))}
                    {users.length === 0 && !loadingUsers && (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                No users found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        <div className="p-4 border-t border-slate-700 flex justify-between items-center">
            <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50 text-white"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-gray-400">Page {page + 1}</span>
            <button
                disabled={users.length < 20}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 bg-slate-800 rounded hover:bg-slate-700 disabled:opacity-50 text-white"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
      </div>
    </div>
  );
}
