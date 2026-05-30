import React from 'react';
import { History, Scroll, DollarSign, Vote, Hand, Siren, Gavel, Users } from 'lucide-react';

interface HistoryTabProps {
  governmentHistory: Array<{
    id: string;
    event_type: string;
    event_data?: Record<string, any>;
    actor_id?: string | null;
    target_id?: string | null;
    description?: string | null;
    created_at: string;
    actor_profile?: { username?: string; avatar_url?: string };
  }>;
}

const EVENT_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  law_created: { icon: Scroll, color: 'text-blue-400', label: 'Law Created' },
  law_passed: { icon: Scroll, color: 'text-green-400', label: 'Law Passed' },
  law_rejected: { icon: Scroll, color: 'text-red-400', label: 'Law Rejected' },
  law_voted: { icon: Vote, color: 'text-purple-400', label: 'Vote Cast' },
  bribe_exposed: { icon: DollarSign, color: 'text-yellow-400', label: 'Bribe Exposed' },
  bribe_submitted: { icon: DollarSign, color: 'text-orange-400', label: 'Bribe Attempted' },
  protest_created: { icon: Hand, color: 'text-orange-400', label: 'Protest Started' },
  protest_joined: { icon: Hand, color: 'text-yellow-400', label: 'Joined Protest' },
  protest_dispersed: { icon: Hand, color: 'text-slate-400', label: 'Protest Dispersed' },
  protest_resolved: { icon: Hand, color: 'text-green-400', label: 'Protest Resolved' },
  emergency_power_used: { icon: Siren, color: 'text-red-400', label: 'Emergency Power' },
  action_warn: { icon: Gavel, color: 'text-yellow-400', label: 'Warning Issued' },
  action_jail: { icon: Gavel, color: 'text-orange-400', label: 'User Jailed' },
  action_ban: { icon: Gavel, color: 'text-red-400', label: 'User Banned' },
  action_mute: { icon: Gavel, color: 'text-purple-400', label: 'User Muted' },
  party_created: { icon: Users, color: 'text-blue-400', label: 'Party Created' },
  election_won: { icon: Users, color: 'text-cyan-400', label: 'Election Won' },
};

export default function HistoryTab({ governmentHistory }: HistoryTabProps) {
  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  if (!governmentHistory || governmentHistory.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <History className="text-slate-400" />
            Government History
          </h2>
          <p className="text-slate-400 mt-1">Recent government actions and events</p>
        </div>
        <div className="text-center py-12 text-slate-500">
          <History className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-slate-300 mb-2">No History Yet</h3>
          <p>Government actions will appear here as they occur.</p>
        </div>
      </div>
    );
  }

  // Group by date
  const grouped: Record<string, typeof governmentHistory> = {};
  governmentHistory.forEach((entry) => {
    const date = new Date(entry.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else {
      key = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    }

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <History className="text-slate-400" />
          Government History
        </h2>
        <p className="text-slate-400 mt-1">
          {governmentHistory.length} recorded {governmentHistory.length === 1 ? 'action' : 'actions'}
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([dateLabel, entries]) => (
          <div key={dateLabel}>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{dateLabel}</h3>
            <div className="space-y-2">
              {entries.map((entry) => {
                const config = EVENT_CONFIG[entry.event_type] || {
                  icon: History,
                  color: 'text-slate-400',
                  label: entry.event_type,
                };
                const Icon = config.icon;

                return (
                  <div
                    key={entry.id}
                    className="bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                      <Icon size={16} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200">{entry.description || config.label}</p>
                      {entry.actor_profile?.username && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          by @{entry.actor_profile.username}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 shrink-0">{getTimeAgo(entry.created_at)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
