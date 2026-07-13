import React, { useEffect, useState } from 'react';
import { usePresenceStore } from '@/lib/presenceStore';
import { Users, X, Clock } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'tc_presence_counter_dismissed';
const SNOOZE_MS = 24 * 60 * 60 * 1000;

type DismissState = { mode: 'period' | 'forever'; expiresAt: number | null };

function readDismiss(): DismissState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DismissState;
    if (parsed.mode === 'forever') return parsed;
    if (parsed.mode === 'period' && parsed.expiresAt && Date.now() < parsed.expiresAt) {
      return parsed;
    }
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

const UserPresenceCounter = () => {
  const onlineCount = usePresenceStore((state) => state.onlineCount);
  const [dismissed, setDismissed] = useState<DismissState | null>(() => readDismiss());

  useEffect(() => {
    if (dismissed?.mode === 'period' && dismissed.expiresAt) {
      const t = setTimeout(() => {
        localStorage.removeItem(STORAGE_KEY);
        setDismissed(null);
      }, Math.max(0, dismissed.expiresAt - Date.now()));
      return () => clearTimeout(t);
    }
  }, [dismissed]);

  if (dismissed) return null;

  const snooze = () => {
    const next: DismissState = { mode: 'period', expiresAt: Date.now() + SNOOZE_MS };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDismissed(next);
    toast.success('Online count hidden for 24 hours');
  };

  const hideForever = () => {
    const next: DismissState = { mode: 'forever', expiresAt: null };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDismissed(next);
    toast.success('Online count hidden');
  };

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
      <Users className="h-3.5 w-3.5 text-cyan-300" />
      <span className="font-semibold text-white">{onlineCount.toLocaleString()}</span>
      <span>online</span>
      <button
        type="button"
        onClick={snooze}
        title="Hide for 24 hours"
        className="ml-0.5 rounded-full p-0.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        <Clock className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={hideForever}
        title="Hide for good"
        className="rounded-full p-0.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

export default UserPresenceCounter;
