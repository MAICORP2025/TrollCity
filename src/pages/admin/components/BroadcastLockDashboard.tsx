import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../lib/store';
import { toast } from 'sonner';
import { 
  Lock, Unlock, Users, Shield, AlertTriangle, 
  CheckCircle, XCircle, RefreshCw, Crown, Settings
} from 'lucide-react';

interface Broadcaster {
  id: string;
  username: string;
  avatar_url: string | null;
  has_broadcast_badge: boolean;
  is_broadcast_locked: boolean;
  is_admin: boolean;
  role: string | null;
  created_at: string;
}

interface LockdownSettings {
  is_enabled: boolean;
  admin_id: string | null;
  reason: string | null;
  updated_at: string | null;
}

interface BroadcasterLimits {
  max_broadcasters: number;
  current_count: number;
}

export default function BroadcastLockDashboard() {
  const { profile, user } = useAuthStore();
  const [lockdownSettings, setLockdownSettings] = useState<LockdownSettings>({
    is_enabled: false,
    admin_id: null,
    reason: null,
    updated_at: null
  });
  const [broadcasterLimits, setBroadcasterLimits] = useState<BroadcasterLimits>({
    max_broadcasters: 100,
    current_count: 0
  });
  const [broadcasters, setBroadcasters] = useState<Broadcaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockingUser, setLockingUser] = useState<string | null>(null);
  const [grantBadgeUser, setGrantBadgeUser] = useState<string | null>(null);
  const [revokeBadgeUser, setRevokeBadgeUser] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLimit, setEditingLimit] = useState(false);
  const [newLimit, setNewLimit] = useState(100);
  const [updatingLimit, setUpdatingLimit] = useState(false);

  const isAdmin = profile?.is_admin || profile?.role === 'admin';

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      // Load lockdown settings
      const { data: lockdownData } = await supabase
        .from('broadcast_lockdown')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
       
      if (lockdownData) {
        setLockdownSettings({
          is_enabled: lockdownData.is_enabled || false,
          admin_id: lockdownData.admin_id,
          reason: lockdownData.reason,
          updated_at: lockdownData.updated_at
        });
      }

      // Load broadcaster limits
      const { data: limitData } = await supabase
        .from('broadcaster_limits')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (limitData) {
        setBroadcasterLimits({
          max_broadcasters: limitData.max_broadcasters || 100,
          current_count: limitData.current_count || 0
        });
        setNewLimit(limitData.max_broadcasters || 100);
      }

      // Load broadcasters with badges
      const { data: broadcasterData } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, has_broadcast_badge, is_broadcast_locked, is_admin, role, created_at')
        .or('has_broadcast_badge.eq.true,is_admin.eq.true')
        .order('created_at', { ascending: false })
        .limit(200);

      setBroadcasters(broadcasterData || []);
    } catch (err) {
      console.error('Error loading data:', err);
      toast.error('Failed to load broadcast data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();

    // Subscribe to changes
    const channel = supabase
      .channel('broadcast_lock_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcast_lockdown' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcaster_limits' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const toggleGlobalLockdown = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'toggle_broadcast_lockdown',
          enabled: !lockdownSettings.is_enabled,
          reason: reason || null
        }
      });

      if (error) throw error;

      toast.success(lockdownSettings.is_enabled 
        ? 'Broadcast lockdown DISABLED - Everyone can broadcast' 
        : 'Broadcast lockdown ENABLED - Only admins can broadcast');
      
      setReason('');
      loadData();
    } catch (err: any) {
      console.error('Error toggling lockdown:', err);
      toast.error(err.message || 'Failed to toggle lockdown');
    }
  };

  const lockIndividualBroadcaster = async (userId: string, locked: boolean) => {
    setLockingUser(userId);
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'lock_broadcaster',
          userId,
          locked
        }
      });

      if (error) throw error;

      toast.success(`${locked ? 'Locked' : 'Unlocked'} broadcaster`);
      loadData();
    } catch (err: any) {
      console.error('Error locking broadcaster:', err);
      toast.error(err.message || 'Failed to update broadcaster');
    } finally {
      setLockingUser(null);
    }
  };

  const grantBadge = async (userId: string) => {
    setGrantBadgeUser(userId);
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'grant_broadcaster_badge',
          userId
        }
      });

      if (error) throw error;

      toast.success('Broadcast badge granted');
      loadData();
    } catch (err: any) {
      console.error('Error granting badge:', err);
      toast.error(err.message || 'Failed to grant badge');
    } finally {
      setGrantBadgeUser(null);
    }
  };

  const revokeBadge = async (userId: string) => {
    setRevokeBadgeUser(userId);
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'revoke_broadcaster_badge',
          userId
        }
      });

      if (error) throw error;

      toast.success('Broadcast badge revoked');
      loadData();
    } catch (err: any) {
      console.error('Error revoking badge:', err);
      toast.error(err.message || 'Failed to revoke badge');
    } finally {
      setRevokeBadgeUser(null);
    }
  };

  const updateMaxBroadcasters = async () => {
    if (newLimit < 1 || newLimit > 500) {
      toast.error('Limit must be between 1 and 500');
      return;
    }
    
    setUpdatingLimit(true);
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'update_broadcaster_limit',
          limit: newLimit
        }
      });
      
      if (error) throw error;
      
      toast.success(`Max broadcasters updated to ${newLimit}`);
      setEditingLimit(false);
      loadData();
    } catch (err: any) {
      console.error('Error updating limit:', err);
      toast.error(err.message || 'Failed to update limit');
    } finally {
      setUpdatingLimit(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-gray-400">
        <Shield className="w-12 h-12 mx-auto mb-4 text-gray-500" />
        <p>Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const filteredBroadcasters = broadcasters.filter(b => 
    b.username?.toLowerCase().includes(searchTerm.toLowerCase()) || false
  );

  const badgeCount = broadcasters.filter(b => b.has_broadcast_badge).length;
  const lockedCount = broadcasters.filter(b => b.is_broadcast_locked).length;
  const adminCount = broadcasters.filter(b => b.is_admin || b.role === 'admin').length;
  const isAtLimit = broadcasterLimits.current_count >= broadcasterLimits.max_broadcasters;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Lock className="w-6 h-6 text-purple-400" />
            Broadcast Lock Control
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Manage global broadcast locks and individual broadcaster permissions
          </p>
        </div>
        <button
          onClick={loadData}
          className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-[#1A1A1A] border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${lockdownSettings.is_enabled ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              {lockdownSettings.is_enabled ? (
                <Lock className="w-5 h-5 text-red-400" />
              ) : (
                <Unlock className="w-5 h-5 text-green-400" />
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400">Global Lock</p>
              <p className={`font-bold ${lockdownSettings.is_enabled ? 'text-red-400' : 'text-green-400'}`}>
                {lockdownSettings.is_enabled ? 'ENABLED' : 'DISABLED'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Crown className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Authorized</p>
              <p className="font-bold text-purple-400">{badgeCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <Lock className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Locked Users</p>
              <p className="font-bold text-red-400">{lockedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Admins</p>
              <p className="font-bold text-blue-400">{adminCount}</p>
            </div>
          </div>
        </div>

        <div className={`bg-[#1A1A1A] border rounded-xl p-4 ${isAtLimit ? 'border-yellow-500/50' : 'border-gray-700'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isAtLimit ? 'bg-yellow-500/20' : 'bg-green-500/20'}`}>
              <Users className={`w-5 h-5 ${isAtLimit ? 'text-yellow-400' : 'text-green-400'}`} />
            </div>
            <div>
              <p className="text-xs text-gray-400">Slots Used</p>
              <p className={`font-bold ${isAtLimit ? 'text-yellow-400' : 'text-green-400'}`}>
                {broadcasterLimits.current_count} / {broadcasterLimits.max_broadcasters}
              </p>
              {isAtLimit && (
                <p className="text-xs text-yellow-500">FULL</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Lockdown Control */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl border border-purple-500/50 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-xl ${lockdownSettings.is_enabled ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              {lockdownSettings.is_enabled ? (
                <Lock className="w-8 h-8 text-red-400" />
              ) : (
                <Unlock className="w-8 h-8 text-green-400" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                Global Broadcast Lockdown
              </h3>
              <p className="text-gray-300 mt-1">
                {lockdownSettings.is_enabled ? (
                  <>
                    <span className="text-red-400 font-semibold">🔴 LOCKDOWN ACTIVE</span>
                    <br />
                    Only administrators can create broadcasts. All other users are blocked.
                  </>
                ) : (
                  <>
                    <span className="text-green-400 font-semibold">🟢 NORMAL MODE</span>
                    <br />
                    All authorized users can broadcast normally.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {lockdownSettings.is_enabled && lockdownSettings.reason && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-300">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              Reason: {lockdownSettings.reason}
            </p>
          </div>
        )}

        <div className="flex items-center gap-4">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for lockdown (optional)"
            className="flex-1 bg-black/40 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none"
          />
          <button
            onClick={toggleGlobalLockdown}
            disabled={loading}
            className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              lockdownSettings.is_enabled
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            } disabled:opacity-50`}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : lockdownSettings.is_enabled ? (
              <>
                <Unlock className="w-4 h-4" />
                Disable Lockdown
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Enable Lockdown
              </>
            )}
          </button>
        </div>
      </div>

      {/* Broadcaster Limit Control */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-500/50 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-xl bg-blue-500/20">
              <Settings className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                Broadcaster Limit
              </h3>
              <p className="text-gray-300 mt-1">
                Maximum number of users allowed to broadcast: <span className="text-blue-400 font-bold">{broadcasterLimits.max_broadcasters}</span>
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Currently <span className={isAtLimit ? 'text-yellow-400 font-bold' : 'text-green-400'}>
                  {broadcasterLimits.current_count}
                </span> of {broadcasterLimits.max_broadcasters} slots used
              </p>
              {isAtLimit && (
                <div className="mt-2 flex items-center gap-2 text-yellow-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Broadcasting limit reached - no new badges can be granted</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {editingLimit ? (
          <div className="flex items-center gap-4">
            <input
              type="number"
              value={newLimit}
              onChange={(e) => setNewLimit(parseInt(e.target.value) || 1)}
              min={1}
              max={500}
              className="w-24 bg-black/40 border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-blue-400 focus:outline-none"
            />
            <button
              onClick={updateMaxBroadcasters}
              disabled={updatingLimit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold disabled:opacity-50"
            >
              {updatingLimit ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
            <button
              onClick={() => setEditingLimit(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-semibold"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingLimit(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Adjust Limit
          </button>
        )}
      </div>

      {/* Broadcaster List */}
      <div className="bg-[#1A1A1A] border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Broadcasters & Permissions
          </h3>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search broadcasters..."
            className="bg-black/40 border border-gray-600 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-2" />
            Loading broadcasters...
          </div>
        ) : filteredBroadcasters.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            No broadcasters found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 pl-2">User</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Badge</th>
                  <th className="pb-3 text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredBroadcasters.map((broadcaster) => (
                  <tr key={broadcaster.id} className="hover:bg-gray-800/50">
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-900/30 border border-purple-500/20 overflow-hidden">
                          {broadcaster.avatar_url ? (
                            <img src={broadcaster.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-purple-300 font-bold">
                              {broadcaster.username?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">{broadcaster.username}</p>
                          <p className="text-xs text-gray-500">{broadcaster.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      {broadcaster.is_broadcast_locked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                          <XCircle className="w-3 h-3" />
                          Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {broadcaster.has_broadcast_badge ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                          <Crown className="w-3 h-3" />
                          Has Badge
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs">No Badge</span>
                      )}
                    </td>
                    <td className="py-3 text-right pr-2">
                      <div className="flex items-center justify-end gap-2">
                        {broadcaster.is_admin || broadcaster.role === 'admin' ? (
                          <span className="text-xs text-blue-400 px-2 py-1 bg-blue-500/10 rounded">
                            Admin
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => lockIndividualBroadcaster(
                                broadcaster.id, 
                                !broadcaster.is_broadcast_locked
                              )}
                              disabled={lockingUser === broadcaster.id}
                              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                                broadcaster.is_broadcast_locked
                                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              } disabled:opacity-50`}
                            >
                              {lockingUser === broadcaster.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : broadcaster.is_broadcast_locked ? (
                                'Unlock'
                              ) : (
                                'Lock'
                              )}
                            </button>
                            
                            {broadcaster.has_broadcast_badge ? (
                              <button
                                onClick={() => revokeBadge(broadcaster.id)}
                                disabled={revokeBadgeUser === broadcaster.id}
                                className="px-3 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                              >
                                {revokeBadgeUser === broadcaster.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  'Revoke Badge'
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => grantBadge(broadcaster.id)}
                                disabled={grantBadgeUser === broadcaster.id || isAtLimit}
                                className="px-3 py-1 rounded text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50"
                              >
                                {grantBadgeUser === broadcaster.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : isAtLimit ? (
                                  'Limit Reached'
                                ) : (
                                  'Grant Badge'
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
