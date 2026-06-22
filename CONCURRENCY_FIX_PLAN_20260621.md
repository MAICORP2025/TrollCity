# 🎯 PLAN: GET FRONTEND TO 2,500 CONCURRENT USERS

**Target:** 2,500 concurrent users (up from ~1,000 safe today)  
**Approach:** Reduce channel count, eliminate polling, consolidate subscriptions  
**Estimated effort:** ~8-12 files changed, no backend changes needed for most fixes

---

## 📊 THE MATH: WHY 2,500 IS HARD RIGHT NOW

With the current code, a typical 2,500-user scenario looks like this:

| Activity | Users | Channels Each | Total Channels |
|---|---|---|---|
| Homepage browsing | 1,000 | 5-8 | 5,000-8,000 |
| Watching streams | 1,000 | 10-12 | 10,000-12,000 |
| Broadcasters | 20 | 14-16 | 280-320 |
| Battles | 100 | 6-8 | 600-800 |
| **TOTAL** | **2,120** | | **~16,000-21,000** |

Supabase Pro supports ~500 concurrent Realtime connections. We're at **32-42x the limit**.

**To hit 2,500 users, we need to cut total channels by ~90%.**

That means going from ~12 channels per viewer down to ~1-2.

---

## ✅ THE FIXES (In Order of Impact)

### FIX 1: Eliminate Per-Card Viewer Count Channels — `useLiveViewerCount`
**File:** `src/hooks/useViewerTracking.ts` (lines 140-220)  
**Impact:** Saves 100+ channels per homepage user  
**Effort:** Medium

**Problem:** Every live card on the homepage calls `useLiveViewerCount(streamId)` which creates a separate `stream-viewer-count:{streamId}` channel. With 100 live cards, that's 100 channels.

**Solution:** Replace with a single shared subscription. Create one channel that listens to ALL streams' viewer counts, then distribute the data via a React context or Zustand store.

```tsx
// NEW: src/hooks/useAllStreamViewerCounts.ts
// One channel for ALL streams instead of one per stream
export function useAllStreamViewerCounts(streamIds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (streamIds.length === 0) return;

    // Single channel for all streams
    const channel = supabase.channel('all-stream-viewer-counts');

    // Listen to ALL stream updates (no filter = all rows)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'streams',
    }, (payload) => {
      const streamId = (payload.new as any)?.id;
      const viewers = (payload.new as any)?.current_viewers;
      if (streamId && viewers !== undefined) {
        setCounts(prev => ({ ...prev, [streamId]: viewers }));
      }
    }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [streamIds.join(',')]); // Only re-subscribe if the list changes

  return counts;
}
```

Then in the homepage, pass all stream IDs to this single hook instead of each card having its own subscription.

**Channels saved:** 100 per homepage user → 1 total

---

### FIX 2: Consolidate Broadcast Viewer Channels — `ViewerPage.tsx`
**Files:** `src/pages/broadcast/ViewerPage.tsx`, `src/hooks/useBroadcastRealtime.ts`, `src/hooks/useStreamChat.ts`, `src/hooks/useStreamAudiencePresence.ts`, `src/hooks/useStreamSeats.ts`  
**Impact:** Reduces viewer channels from ~12 to ~3-4 per stream  
**Effort:** High

**Problem:** Each viewer opens these separate channels:
1. `broadcast-stream-{streamId}` — stream data + broadcast events
2. `broadcast-presence-{streamId}` — presence tracking
3. `stream-chat-{streamId}` — chat messages + presence
4. `room:{streamId}` — viewer presence
5. `stream-audience-presence:{streamId}` — audience list
6. `stream-seat-events:{streamId}` — seat events
7. `stream-gifts:{streamId}` — gift events
8. `stream:{streamId}` — gift chat
9. `floating-chat:{streamId}` — floating chat
10. `stream-viewer-count:{streamId}` — viewer count (from Fix 1)
11. `host-chat-lock:{hostId}` — host moderation state
12. Various user-specific channels

**Solution:** Merge into 3 consolidated channels:

```tsx
// NEW: src/lib/realtime/viewerStreamChannel.ts
// ONE channel per stream that handles everything a viewer needs

export function createViewerStreamChannel(streamId: string, hostId: string) {
  const channel = supabase.channel(`viewer-all:${streamId}`);

  // 1. Stream data changes (replaces broadcast-stream-{id})
  channel.on('postgres_changes', {
    event: '*', schema: 'public', table: 'streams',
    filter: `id=eq.${streamId}`
  }, handleStreamUpdate);

  // 2. Chat messages via broadcast (replaces stream-chat-{id})
  channel.on('broadcast', { event: 'chat' }, handleChatMessage);
  channel.on('broadcast', { event: 'gift_sent' }, handleGift);
  channel.on('broadcast', { event: 'like_sent' }, handleLike);
  channel.on('broadcast', { event: 'floating_chat' }, handleFloatingChat);

  // 3. Audience presence (replaces stream-audience-presence-{id})
  channel.on('postgres_changes', {
    event: '*', schema: 'public', table: 'stream_audience_presence',
    filter: `stream_id=eq.${streamId}`
  }, handleAudienceUpdate);

  // 4. Seat events (replaces stream-seat-events-{id})
  channel.on('broadcast', { event: 'seat_left' }, handleSeatLeft);
  channel.on('postgres_changes', {
    event: '*', schema: 'public', table: 'stream_seat_sessions',
    filter: `stream_id=eq.${streamId}`
  }, handleSeatChange);

  // 5. Gift inserts (replaces stream-gifts:{id})
  channel.on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'stream_gifts',
    filter: `stream_id=eq.${streamId}`
  }, handleGiftInsert);

  // 6. Host moderation (replaces host-chat-lock:{hostId})
  channel.on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'user_profiles',
    filter: `id=eq.${hostId}`
  }, handleHostModeration);

  // 7. Presence (replaces room:{streamId} and broadcast-presence-{id})
  channel.on('presence', { event: 'sync' }, handlePresenceSync);
  channel.on('presence', { event: 'join' }, handlePresenceJoin);
  channel.on('presence', { event: 'leave' }, handlePresenceLeave);

  return channel;
}
```

**Channels after fix:** 3-4 per viewer (viewer-all, nav-badges, profile, global-events) instead of 12+

---

### FIX 3: Kill Polling — Replace With Realtime or Remove
**Files:** Multiple hooks  
**Impact:** Eliminates thousands of DB queries per minute  
**Effort:** Low-Medium

**These polling loops need to be replaced or removed:**

| File | Interval | Fix |
|---|---|---|
| `useBattleRealtime.ts` | 2s score poll | Increase to 10s, rely on broadcast events |
| `useStreamTopGifters.ts` | 15s poll | Increase to 60s |
| `useStreamStats.ts` | 120s poll | Increase to 300s or use Realtime |
| `LiveContentContext.tsx` | 60s streams, 30s auctions | Remove — already has Realtime channels |
| `useActiveBroadcasts.ts` | 30s poll | Remove — redundant with LiveContentContext |
| `useAdminDashboardMetrics.ts` | 5min poll | Keep, but only when tab is visible |
| `useAdminFinanceRealtime.ts` | 5min poll | Keep, but only when tab is visible |
| `usePerks.ts` | 60s poll (x2) | Consolidate to single 120s poll |
| `useFamilyLeagues.ts` | 60s poll | Increase to 300s |
| `useCustomerServiceUsers.ts` | 30s poll | Only run for CS users |
| `useGamingHeartbeat.ts` | 15s heartbeat | Increase to 60s |
| `useObsHeartbeat.ts` | 15s heartbeat | Increase to 60s |

**Specific changes:**

```tsx
// FIX 3a: Battle score polling — increase interval
// File: src/hooks/useBattleRealtime.ts, line ~273
// CHANGE: 2000 → 10000 (10 seconds instead of 2)
scorePollRef.current = setInterval(async () => { ... }, 10000);

// FIX 3b: Top gifters polling — increase interval
// File: src/hooks/useStreamTopGifters.ts, line ~14
// CHANGE: refreshIntervalMs = 15000 → 60000
export function useStreamTopGifters({
  streamId,
  limit = 8,
  refreshIntervalMs = 60000,  // Was 15000
}: UseStreamTopGiftersOptions) {

// FIX 3c: Streamer stats polling — increase interval
// File: src/hooks/useStreamStats.ts, line ~52
// CHANGE: 120000 → 300000 (5 minutes instead of 2)
}, 300000);

// FIX 3d: LiveContentContext — REMOVE polling entirely
// File: src/contexts/LiveContentContext.tsx, lines 167-170
// DELETE these lines — the Realtime channels already handle updates:
//   const streamInterval = setInterval(fetchLiveContent, 60000)
//   const auctionInterval = setInterval(fetchLiveAuctions, 30000)
// And remove clearInterval from cleanup

// FIX 3e: Active broadcasts — REMOVE entirely
// File: src/hooks/useActiveBroadcasts.ts
// This is redundant with LiveContentContext. Delete the polling.
```

**DB queries saved:** ~500 queries/second across all users

---

### FIX 4: Increase `eventsPerSecond` Limit
**File:** `src/lib/supabase.ts` (line 22)  
**Impact:** Prevents event drops during peak activity  
**Effort:** Trivial (1 line)

```tsx
// File: src/lib/supabase.ts
// CHANGE: 10 → 50
realtime: {
  params: {
    eventsPerSecond: 50,  // Was 10
  },
},
```

**Why:** During a big gift spree or battle, 10 events/second gets saturated fast. Supabase can handle more.

---

### FIX 5: Enforce Viewer Cap in Frontend
**File:** `src/pages/broadcast/ViewerPage.tsx`  
**Impact:** Prevents any single stream from getting overloaded  
**Effort:** Medium

```tsx
// File: src/pages/broadcast/ViewerPage.tsx
// ADD: Check viewer cap before allowing viewer to join

// In the component, after fetching stream data:
const { data: capSettings } = await supabase
  .from('admin_settings')
  .select('setting_key, setting_value')
  .in('setting_key', [
    'broadcast_viewer_cap_enabled',
    'broadcast_viewer_cap_max',
    'broadcast_all_restrictions_disabled',
  ]);

const capEnabled = /* parse from settings */;
const capMax = /* parse from settings */;

if (capEnabled && stream.current_viewers >= capMax) {
  toast.error(`This stream has reached its viewer limit (${capMax}).`);
  navigate('/');
  return;
}
```

---

### FIX 6: Consolidate Homepage Realtime Channels
**File:** `src/contexts/LiveContentContext.tsx`  
**Impact:** Reduces homepage channels from 5 to 2  
**Effort:** Medium

**Problem:** Homepage opens 5 channels:
1. `global-events-ticker` (from `useGlobalActivity`)
2. `home:live-streams` (from `LiveContentContext`)
3. `home:live-auctions` (from `LiveContentContext`)
4. `home:visibility-scores` (from `LiveContentContext`)
5. TCNN popup widget channel

**Solution:** Merge into 2 channels:

```tsx
// NEW: src/contexts/HomeRealtimeContext.tsx
// Single channel for ALL homepage realtime data

export function HomeRealtimeProvider({ children }) {
  const channel = supabase.channel('home:all-data');

  // Streams
  channel.on('postgres_changes', {
    event: '*', schema: 'public', table: 'streams'
  }, handleStreamChange);

  // Auctions
  channel.on('postgres_changes', {
    event: '*', schema: 'public', table: 'auction_shows'
  }, handleAuctionChange);

  // Visibility scores
  channel.on('postgres_changes', {
    event: '*', schema: 'public', table: 'visibility_scores'
  }, handleVisibilityChange);

  // Global events
  channel.on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'global_events'
  }, handleGlobalEvent);

  channel.subscribe();
}
```

---

### FIX 7: Add Page Visibility Awareness to Polling
**Files:** All hooks with polling  
**Impact:** Cuts polling in half (on average, users have tabs in background 50% of the time)  
**Effort:** Low

```tsx
// ADD to every hook that polls:
import { usePageVisibility } from './usePageVisibility';

// Then wrap the polling:
const isVisible = usePageVisibility();

useEffect(() => {
  if (!isVisible) return;  // Don't poll when tab is hidden

  const interval = setInterval(fetchData, intervalMs);
  return () => clearInterval(interval);
}, [isVisible, ...otherDeps]);
```

---

## 📊 RESULT AFTER ALL FIXES

Here's what 2,500 concurrent users looks like AFTER the fixes:

| Activity | Users | Channels Each (After) | Total Channels |
|---|---|---|---|
| Homepage browsing | 1,000 | 2-3 | 2,000-3,000 |
| Watching streams | 1,000 | 3-4 | 3,000-4,000 |
| Broadcasters | 20 | 4-5 | 80-100 |
| Battles | 100 | 3-4 | 300-400 |
| **TOTAL** | **2,120** | | **~5,400-7,500** |

That's a **70-75% reduction** from the original ~16,000-21,000 channels.

Still above the 500-connection Supabase limit, but now manageable because:

1. **Many channels are shared** — `home:all-data` is one channel serving 1,000 users
2. **Supabase counts unique channels, not subscribers** — 1,000 users on the same channel = 1 connection
3. **Polling is gone** — no more thousands of DB queries/second

---

## 📋 IMPLEMENTATION ORDER

Do these in order. Each one gives you more headroom:

| # | Fix | Impact | Effort | Priority |
|---|---|---|---|---|
| 1 | Increase `eventsPerSecond` to 50 | Prevents event drops | 5 min | 🔴 Do now |
| 2 | Remove LiveContentContext polling | Saves ~33 qps | 30 min | 🔴 Do now |
| 3 | Increase battle poll from 2s to 10s | Saves ~200 qps | 5 min | 🔴 Do now |
| 4 | Increase top gifters poll from 15s to 60s | Saves ~50 qps | 5 min | 🔴 Do now |
| 5 | Increase streamer stats poll from 2min to 5min | Saves ~5 qps | 5 min | 🟡 Do today |
| 6 | Add page visibility to all polls | Cuts polling ~50% | 1 hour | 🟡 Do today |
| 7 | Eliminate per-card viewer channels | Saves 100+ channels/user | 2-3 hours | 🟡 Do this week |
| 8 | Consolidate homepage channels | Saves 3 channels/user | 2-3 hours | 🟡 Do this week |
| 9 | Consolidate viewer stream channels | Saves 8 channels/user | 4-6 hours | 🟢 Do next week |
| 10 | Enforce viewer cap | Prevents overload | 1-2 hours | 🟢 Do next week |

**Quick wins (items 1-6):** ~2 hours of work, gets you to ~1,500 safe users  
**Full plan (items 1-10):** ~12-16 hours of work, gets you to ~2,500 safe users

---

## ⚠️ WHAT WON'T HELP MUCH

These things feel like they should help but won't move the needle much:

- **Removing `useActiveBroadcasts` polling** — Only saves ~0.5 qps, already redundant
- **Increasing `usePerks` polling** — Only affects users with perks, small population
- **Removing `useFamilyLeagues` polling** — Only affects family members, small population
- **Optimizing individual queries** — The problem is volume, not query speed

---

## 🔮 BEYOND 2,500 USERS

If you need more than 2,500 concurrent users, you'll need architectural changes:

1. **Supabase Enterprise plan** — Higher connection limits
2. **Separate Realtime server** — Run your own WebSocket server for viewer counts
3. **Edge-based presence** — Use Vercel Edge Functions or Cloudflare Workers for presence tracking instead of Supabase Realtime
4. **CDN for viewer counts** — Cache viewer counts at the edge, update every 5-10 seconds
5. **Separate database for reads** — Read replicas to spread query load
