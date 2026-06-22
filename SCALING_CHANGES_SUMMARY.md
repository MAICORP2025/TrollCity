# Scaling Optimization Changes Summary

## Goal
Prepare the frontend for ~2,500 concurrent users without changing product behavior.

## Changes Made

### Phase 2: Realtime Manager Enforcement

**New Files:**
- `src/lib/realtime/RealtimeManager.ts` — Extended with:
  - `subscribePageChannel()` / `removePageChannel()` — Page-level channel helpers
  - `registerPolling()` / `unregisterPolling()` / `getPollingRegistry()` — Polling registry
  - `getChannelHealth()` — Returns green/yellow/red based on active channel count
  - `getPageChannelStats()` — Returns page channel stats for monitoring
- `src/contexts/PageChannelContext.tsx` — Page-level channel provider that manages a single page channel per navigation state
- `src/hooks/useVisibilityPolling.ts` — Visibility-aware polling hook with registry integration

### Phase 3: Database Write Reduction

**New Files:**
- `src/lib/batchWrites.ts` — Batching and deduplication utilities:
  - `createBatchWriter()` — Generic batch write collector with flush interval and beforeunload
  - `queueCityAdImpression()` / `queueCityAdClick()` — Batched city_ads writes (flush every 60s)
  - `reportBugDedup()` — Client-side dedup for app_bug_reports (5-min window per error key)
  - `updatePresenceRoute()` — Route dedup for user_presence_routes (skips if route unchanged)

**Modified Files:**
- `src/hooks/useUserPresenceRoute.ts` — Added route dedup (skips write if route hasn't changed), resets cache on visibility return
- `src/components/promo/PromoSlot.tsx` — Uses `queueCityAdImpression()` instead of direct RPC
- `src/components/promo/PromoAdCard.tsx` — Uses `queueCityAdClick()` instead of direct RPC/update

### Phase 4: Polling Cleanup

**Modified Files:**
- `src/contexts/LiveContentContext.tsx`:
  - Consolidated 3 separate channels (`home:live-streams`, `home:live-auctions`, `home:visibility-scores`) into 1 `home:global` channel
  - Added visibility guards to stream (60s) and auction (30s) polling intervals
- `src/pages/broadcast/BroadcastPage.tsx`:
  - Seat tick (1s): added visibility guard
  - Heartbeat ping: 30s → 60s, added visibility guard
  - Watch time emit: 30s → 60s, added visibility guard
- `src/pages/broadcast/ViewerPage.tsx`:
  - Audience heartbeat: 30s → 60s, added visibility guard
  - Watch time recording: added visibility guard
- `src/hooks/useStreamTopGifters.ts`:
  - Default refresh interval: 15s → 60s
  - Added visibility guard (reschedules when hidden)
- `src/hooks/useBattleRealtime.ts`:
  - Score poll interval: 2s → 10s

### Phase 5: Supabase Realtime Config

**Modified Files:**
- `src/lib/supabase.ts` — `eventsPerSecond: 10 → 50`
- `src/components/originalChannel.tsx` — `eventsPerSecond: 10 → 50`

### Phase 6: Monitoring

**New Files:**
- `src/components/admin/RealtimeDebugPanel.tsx` — Dev-only floating panel showing:
  - Active channel count with green/yellow/red health indicator
  - Total created/removed/leaked channels
  - Active polling loops
  - Per-channel details (ref count, subscribers, status)
  - Per-polling details (label, interval, visibility-only flag)

**Modified Files:**
- `src/components/admin/index.ts` — Export RealtimeDebugPanel
- `src/App.tsx` — Import and render RealtimeDebugPanel in DEV mode

## Expected Impact

| Metric | Before | After |
|---|---|---|
| Home page channels | 3 per user | 1 per user |
| Channels per normal user | 10-12 | 2-3 |
| Subscriptions at 2,500 users | 25,000-30,000 | 5,000-7,500 |
| Battle score poll interval | 2s | 10s |
| Top gifters poll interval | 15s | 60s |
| Viewer heartbeat interval | 30s | 60s |
| Background tab polling | Full rate | Paused/slowed |
| city_ads writes | Per impression/click | Batched (60s) |
| user_presence_routes writes | Every navigation + 5s debounce | Only when route changes |
| app_bug_reports writes | Per error | Deduped (5-min window) |
| Supabase events/sec | 10 | 50 |

## Validation Checklist

- [ ] Home page opens with 1 active channel (home:global)
- [ ] Broadcast page opens with 2-3 active channels
- [ ] Navigating pages removes the previous page channel
- [ ] Background tabs pause/slow polling
- [ ] No UI features disappear
- [ ] RealtimeDebugPanel shows green health at normal usage
- [ ] Channel count stays ≤ 3 for normal users
