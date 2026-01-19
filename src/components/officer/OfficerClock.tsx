import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { LogIn, LogOut, Clock, User, Search } from 'lucide-react';
import { format12hr } from '../../utils/timeFormat';

interface OfficerClockProps {
  onActionComplete?: () => void;
}

export default function OfficerClock({ onActionComplete }: OfficerClockProps) {
  const { user, profile } = useAuthStore();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Admin/Manual Mode
  const [targetUsername, setTargetUsername] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.troll_role === 'admin';
  const isLead = profile?.role === 'lead_troll_officer' || profile?.is_lead_officer;

  const fetchActiveSession = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('officer_work_sessions')
        .select('*')
        .eq('officer_id', uid)
        .is('clock_out', null)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    } catch (_err) {
      console.error('Error fetching session:', _err);
      return null;
    }
  };

  useEffect(() => {
    if (user) {
      fetchActiveSession(user.id).then(session => {
        setActiveSession(session);
        setLoading(false);
      });
    }
  }, [user]);

  const handleClockToggle = async (uid?: string) => {
    const targetId = uid ?? user?.id;
    if (!targetId) {
      toast.error('User not found');
      return;
    }
    setActionLoading(true);
    try {
      const currentSession = targetId === user?.id ? activeSession : await fetchActiveSession(targetId);
      
      if (currentSession) {
        // Clock Out
        const { error } = await supabase.rpc('manual_clock_out', { 
          p_session_id: currentSession.id 
        });
        if (error) throw error;
        toast.success(`Clocked out successfully at ${format12hr(new Date())}`);
      } else {
        // Clock In
        const { error } = await supabase.rpc('manual_clock_in', { 
          p_officer_id: targetId 
        });
        if (error) throw error;
        toast.success(`Clocked in successfully at ${format12hr(new Date())}`);
      }
      
      if (targetId === user?.id) {
        const nextSession = await fetchActiveSession(targetId);
        setActiveSession(nextSession);
      }
      
      onActionComplete?.();
    } catch (err: any) {
      console.error('Clock toggle error:', err);
      toast.error(err.message || 'Failed to toggle clock status');
    } finally {
      setActionLoading(false);
    }
  };

  const searchUser = async () => {
    if (!targetUsername) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `${targetUsername}%`)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        setTargetUserId(data.id);
        toast.success(`Found user: ${data.username}`);
      } else {
        toast.error('User not found');
        setTargetUserId(null);
      }
    } catch {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) return null;

  return (
    <div className="bg-black/40 border border-purple-500/30 rounded-2xl p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold">Officer Duty Terminal</h2>
          </div>
          {activeSession && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full animate-pulse">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              ON DUTY
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">Current Time</span>
            <span className="text-2xl font-mono text-white">{format12hr(new Date())}</span>
          </div>

          {activeSession && (
            <div className="flex flex-col gap-1 p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-xs text-gray-400">Shift Started At</span>
              <span className="text-lg font-medium text-purple-300">{format12hr(activeSession.clock_in)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {/* Personal Clock Button */}
        <button
          onClick={() => handleClockToggle()}
          disabled={actionLoading}
          className={`w-full py-4 rounded-xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl ${
            activeSession 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20' 
              : 'bg-green-600 hover:bg-green-700 text-white shadow-green-900/20'
          }`}
        >
          {actionLoading ? 'Processing...' : (
            activeSession ? (
              <><LogOut size={24} /> CLOCK OUT</>
            ) : (
              <><LogIn size={24} /> CLOCK IN</>
            )
          )}
        </button>

        {/* Admin/Lead Manual Clock */}
        {(isAdmin || isLead) && (
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2">
              <User size={14} /> MANUAL CLOCK (ADMIN)
            </h3>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Username..."
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500/50 outline-none"
                />
                <button 
                  onClick={searchUser}
                  disabled={isSearching}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <Search size={16} />
                </button>
              </div>
              {targetUserId && (
                <button
                  onClick={() => handleClockToggle(targetUserId)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs font-bold whitespace-nowrap"
                >
                  TOGGLE STATUS
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
