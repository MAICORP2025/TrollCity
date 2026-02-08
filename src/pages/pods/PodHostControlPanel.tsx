import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, UserX, Settings, Users, X, Hand, ShieldBan, Coins, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PodHostControlPanelProps {
  roomId: string;
  requests: any[];
  onApproveRequest: (userId: string) => void;
  onDenyRequest: (userId: string) => void;
  onClose: () => void;
}

export default function PodHostControlPanel({
  roomId,
  requests,
  onApproveRequest,
  onDenyRequest,
  onClose
}: PodHostControlPanelProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'whitelist' | 'banned' | 'settings'>('requests');
  const [whitelist, setWhitelist] = useState<any[]>([]);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState({ guest_price: 0 });
  const [whitelistInput, setWhitelistInput] = useState('');

  const fetchWhitelist = useCallback(async () => {
    const { data } = await supabase
      .from('pod_whitelists')
      .select('*, user:user_profiles(id, username, avatar_url)')
      .eq('room_id', roomId);
    if (data) setWhitelist(data);
  }, [roomId]);

  const fetchBanned = useCallback(async () => {
    const { data } = await supabase
      .from('pod_bans')
      .select('*, user:user_profiles(id, username, avatar_url)')
      .eq('room_id', roomId);
    if (data) setBannedUsers(data);
  }, [roomId]);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('pod_rooms')
      .select('guest_price')
      .eq('id', roomId)
      .single();
    if (data) setSettings(data);
  }, [roomId]);

  // Fetch Data on Tab Change
  useEffect(() => {
    if (activeTab === 'whitelist') fetchWhitelist();
    if (activeTab === 'banned') fetchBanned();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab, roomId, fetchWhitelist, fetchBanned, fetchSettings]);

  const handleAddToWhitelist = async () => {
    if (!whitelistInput.trim()) return;
    
    // Find user first
    const { data: user } = await supabase
        .from('user_profiles')
        .select('id')
        .ilike('username', whitelistInput.trim())
        .maybeSingle();

    if (!user) {
        toast.error('User not found');
        return;
    }

    const { error } = await supabase.from('pod_whitelists').insert({
        room_id: roomId,
        user_id: user.id
    });

    if (error) {
        toast.error('Failed to add user');
    } else {
        toast.success('User whitelisted');
        setWhitelistInput('');
        fetchWhitelist();
    }
  };

  const handleRemoveFromWhitelist = async (userId: string) => {
    await supabase.from('pod_whitelists').delete().eq('room_id', roomId).eq('user_id', userId);
    setWhitelist(prev => prev.filter(w => w.user_id !== userId));
  };

  const handleUnban = async (userId: string) => {
    await supabase.from('pod_bans').delete().eq('room_id', roomId).eq('user_id', userId);
    setBannedUsers(prev => prev.filter(b => b.user_id !== userId));
    toast.success('User unbanned');
  };

  const handleSaveSettings = async () => {
    const { error } = await supabase
        .from('pod_rooms')
        .update({ guest_price: settings.guest_price })
        .eq('id', roomId);
    
    if (error) toast.error('Failed to save settings');
    else toast.success('Settings saved');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-[#0A0814] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            Host Control Panel
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button 
            onClick={() => setActiveTab('requests')}
            className={`flex-1 p-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'requests' ? 'bg-purple-600/20 text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:bg-white/5'}`}
          >
            <Hand size={16} />
            Requests
            {requests.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{requests.length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('whitelist')}
            className={`flex-1 p-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'whitelist' ? 'bg-purple-600/20 text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:bg-white/5'}`}
          >
            <Users size={16} />
            Auto-Approved
          </button>
          <button 
            onClick={() => setActiveTab('banned')}
            className={`flex-1 p-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'banned' ? 'bg-purple-600/20 text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:bg-white/5'}`}
          >
            <ShieldBan size={16} />
            Banned
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex-1 p-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'settings' ? 'bg-purple-600/20 text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:bg-white/5'}`}
          >
            <Coins size={16} />
            Pricing
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
            {activeTab === 'requests' && (
                <div className="space-y-4">
                    {requests.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">No pending requests</div>
                    ) : (
                        requests.map(req => (
                            <div key={req.user_id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                                        <img src={req.user?.avatar_url} className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-white">{req.user?.username}</div>
                                        <div className="text-xs text-gray-400">Requesting to speak</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onApproveRequest(req.user_id)}
                                        className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white rounded-lg transition-colors"
                                    >
                                        <UserPlus size={18} />
                                    </button>
                                    <button 
                                        onClick={() => onDenyRequest(req.user_id)}
                                        className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
                                    >
                                        <UserX size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'whitelist' && (
                <div className="space-y-6">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Enter username to auto-approve..." 
                            className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                            value={whitelistInput}
                            onChange={(e) => setWhitelistInput(e.target.value)}
                        />
                        <button 
                            onClick={handleAddToWhitelist}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold"
                        >
                            Add
                        </button>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Whitelisted Users</h3>
                        {whitelist.map(w => (
                            <div key={w.id} className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                                <span className="text-white">{w.user?.username}</span>
                                <button 
                                    onClick={() => handleRemoveFromWhitelist(w.user_id)}
                                    className="text-red-400 hover:text-red-300 p-1"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {whitelist.length === 0 && <div className="text-sm text-gray-500">No users whitelisted</div>}
                    </div>
                </div>
            )}

            {activeTab === 'banned' && (
                <div className="space-y-4">
                    {bannedUsers.length === 0 ? (
                        <div className="text-center text-gray-500 py-10">No banned users</div>
                    ) : (
                        bannedUsers.map(ban => (
                            <div key={ban.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                                        <img src={ban.user?.avatar_url} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="font-bold text-white">{ban.user?.username}</div>
                                </div>
                                <button 
                                    onClick={() => handleUnban(ban.user_id)}
                                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg"
                                >
                                    Unban
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-400 mb-2">Guest Price (Troll Coins)</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                min="0"
                                className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white text-lg focus:outline-none focus:border-purple-500"
                                value={settings.guest_price}
                                onChange={(e) => setSettings({ ...settings, guest_price: parseInt(e.target.value) || 0 })}
                            />
                            <div className="text-yellow-400 font-bold">COINS</div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Set to 0 for free entry (Requests enabled).<br/>
                            If set &gt; 0, users pay to become speakers immediately (Auto-Entry).
                        </p>
                    </div>

                    <button 
                        onClick={handleSaveSettings}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors"
                    >
                        Save Settings
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
