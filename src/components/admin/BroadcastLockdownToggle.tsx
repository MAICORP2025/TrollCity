import React, { useState } from 'react';
import { useBroadcastLockdown } from '../../lib/hooks/useBroadcastLockdown';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { Lock, Unlock, Radio, AlertCircle } from 'lucide-react';

export default function BroadcastLockdownToggle() {
  const { profile } = useAuthStore();
  const { settings, loading, updateSettings } = useBroadcastLockdown();
  const [adminBroadcastRoom, setAdminBroadcastRoom] = useState(settings.admin_broadcast_room || '');

  const isAdmin = profile?.is_admin || profile?.role === 'admin';

  if (!isAdmin) {
    return null;
  }

  const handleToggle = async () => {
    const newSettings = {
      ...settings,
      enabled: !settings.enabled,
      admin_broadcast_room: adminBroadcastRoom || null
    };
    try {
      await updateSettings(newSettings);
      toast.success(newSettings.enabled ? 'Broadcast lockdown enabled' : 'Broadcast lockdown disabled');
    } catch (err) {
      console.error('Failed to toggle lockdown', err);
      toast.error('Failed to update lockdown setting');
    }
  };

  const handleAdminRoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRoom = e.target.value;
    setAdminBroadcastRoom(newRoom);
    
    const newSettings = {
      ...settings,
      admin_broadcast_room: newRoom || null
    };
    try {
      await updateSettings(newSettings);
      toast.success('Admin broadcast room updated');
    } catch (err) {
      console.error('Failed to update admin broadcast room', err);
      toast.error('Could not update admin broadcast room');
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-500/50 p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${settings.enabled ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
            {settings.enabled ? (
              <Lock className={`w-6 h-6 ${settings.enabled ? 'text-red-400' : 'text-green-400'}`} />
            ) : (
              <Unlock className="w-6 h-6 text-green-400" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Broadcast Lockdown Control</h3>
            <p className="text-gray-300 text-sm mt-1">
              {settings.enabled 
                ? '🔴 Only you can create broadcasts. Others can only join your broadcast.' 
                : '🟢 Everyone can create and join broadcasts normally.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Lockdown Toggle */}
        <div className="flex items-center justify-between bg-black/40 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <Radio className={`w-5 h-5 ${settings.enabled ? 'text-red-400' : 'text-green-400'}`} />
            <div>
              <p className="font-semibold text-white">
                {settings.enabled ? 'Lockdown Active' : 'Lockdown Off'}
              </p>
              <p className="text-xs text-gray-400">
                {settings.enabled 
                  ? 'Only admin can broadcast right now'
                  : 'Anyone can create broadcasts'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              settings.enabled
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? '...' : settings.enabled ? 'Turn Off' : 'Turn On'}
          </button>
        </div>

        {/* Admin Broadcast Room (for organizing admin's broadcast) */}
        <div className="bg-black/40 rounded-lg p-4 border border-gray-700">
          <label className="block text-sm font-semibold text-white mb-2">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-blue-400" />
              Admin Broadcast Room Name (Optional)
            </div>
            <p className="text-xs text-gray-400 ml-6">
              Set a specific broadcast room name when lockdown is active. Leave empty for default.
            </p>
          </label>
          <input
            type="text"
            value={adminBroadcastRoom}
            onChange={handleAdminRoomChange}
            placeholder="e.g., admin-only-room, special-event"
            className="w-full bg-black/60 border border-gray-600 rounded px-4 py-2 text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none"
            disabled={loading}
          />
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-semibold mb-1">When Lockdown is Active:</p>
            <ul className="space-y-1 text-xs">
              <li>✓ Only you (admin) can create new broadcasts</li>
              <li>✓ Other users can join and participate in your broadcast</li>
              <li>✓ Other users can chat, send gifts, and interact normally</li>
              <li>✓ Turn off anytime to restore normal broadcast creation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
