# FRONTEND_5K_SCALING_SWEEP (5k concurrency)

## Scope
Assess whether the frontend pages/hooks are compatible with ~5,000 concurrent users, focusing on:
- Live video delivery (LiveKit RTC)
- Supabase realtime (presence, chat, gifts)
- Battle mode (extra LiveKit room + heavier UI)
- Non-video pages (auctions, coin store, etc.)

## Key premise: CDN vs LiveKit
If this app delivers *live* video using **LiveKit RTC**, then a CDN does **not** materially change the core real-time bottleneck (signaling + WebRTC bandwidth/CPU). A CDN helps for:
- static assets (images/icons)
- gift media (sounds, animations) if served as files
- replay files if served as HLS/MP4

The “5k” risk is primarily:
1) LiveKit capacity (rooms, subscriptions, bitrate)
2) client JS event rate (chat/gifts/presence)
3) server realtime throughput (Supabase)
4) DB query cost triggered by events (e.g., gift enrichment)

## Evidence already collected
### Auctions floor page
**File:** `src/pages/AuctionsPage.tsx`
- Uses Supabase polling every **15s** to refresh `auction_shows`.
- Renders auction cards; no RTC.
- **Frontend scalability risk:** medium (polling load at scale)
- **Conclusion:** not a LiveKit/RTC bottleneck.

### Broadcast/Battle/Viewer pages (RTC heavy)
From `src/components/broadcast/BattleView.tsx` and the broadcast/viewer page structure observed earlier:
- Battle mode opens a **second LiveKit room**: `battle-${battleId}`.
- Viewer/broadcast uses LiveKit rooms and subscribes to participant tracks.
- Chat/gifts/presence use Supabase realtime and/or broadcast channels.
- There is evidence of throttling/dedupe patterns (gift animation ids, trackRevision debouncing), but **5k concurrency still depends on system-level RTC + realtime fanout.**

## Hot-path checklist to confirm in the rest of the repo
For each of these features (auction page, broadcast page, viewer page, coin store, chats, battle view, gifts), record:
- Does it use LiveKit RTC? (yes/no)
- Which tracks are subscribed (audio-only vs video) and whether passive users still subscribe to video
- How many realtime subscriptions are created per client
- Whether channels are properly cleaned up on unmount
- Whether event handlers call expensive DB reads / N+1 queries per event
- Whether state updates are throttled/batched
- Caps/limits on UI growth (message lists, gift lists)

## Preliminary conclusion (without full sweep)
- Auctions/coin-store pages are more feasible for 5k than live RTC pages.
- Broadcast/viewer/chats/gifts/battle are the likely scalability limits.
- Frontend optimizations help (memoization, message cap, gift dedupe), but do not remove the fundamental cost of:
  - 5k concurrent WebRTC sessions
  - realtime fanout for chat/gift/presence

## Next steps (what I would do next)
1) Inspect and document:
   - `useStreamRealtime`
   - `useStreamAudiencePresence`
   - gift pipeline (postgres changes + enrichment)
   - chat pipeline (floating chat channel)
2) Inspect LiveKit join/subscription behavior in:
   - viewer side (`useLiveKitRoom` usage)
   - seat video subscription logic
3) Quantify event rates:
   - messages/sec per client
   - gifts/sec per client
   - presence update frequency

## Status
- This file exists and can be previewed in your editor.

