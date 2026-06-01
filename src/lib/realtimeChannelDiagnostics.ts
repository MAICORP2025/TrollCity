/**
 * Realtime Channel Diagnostics
 * 
 * Logs active Supabase channel count and names at key lifecycle points.
 * Uses the built-in supabaseRealtimeDebug counters from supabase.ts.
 * Only active in development mode.
 */

import { supabaseRealtimeCounters } from './supabase';

const DEV = import.meta.env.DEV;

let lastLoggedKey = '';

export function logActiveChannels(context: string) {
  if (!DEV) return;

  const counters = supabaseRealtimeCounters as any;
  const activeChannels: string[] = counters.activeChannels || [];
  const count = activeChannels.length;
  const key = `${context}:${count}`;

  // Only log when count or context changes
  if (key === lastLoggedKey) return;
  lastLoggedKey = key;

  console.log(
    `%c[Channels] ${context}: ${count} active`,
    'color: #22d3ee; font-weight: bold;',
    activeChannels.sort()
  );
}

export function resetChannelDiagnostics() {
  lastLoggedKey = '';
}
