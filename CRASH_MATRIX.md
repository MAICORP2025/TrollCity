
# Troll City "Scale Safe" Diagnostic Report & Crash Matrix

## 1. Executive Summary
The current architecture has **Critical Scalability Flaws** that will cause system failure under viral load (1k+ concurrent users). While the "Gift Ledger" migration (`20270303000006`) provides a solid foundation for financial transactions, the Chat, Leaderboard, and Media Delivery systems are not ready.

## 2. Crash Matrix (Non-Negotiable)

| Scenario | Expected Behavior | Actual Behavior | Result |
| :--- | :--- | :--- | :--- |
| **10k Users Join Stream** | Viewers see HLS, presence counts update every 10s. | Every join triggers `presence` event + `SELECT` on profiles. | **CRASH**: WebSocket storm + DB Connection Limit hit. |
| **Chat Spam (100 msgs/sec)** | Messages buffered, broadcasted via ephemeral channel. | Every message is `INSERT` to DB. Clients fetch `user_profiles` + `RPC vehicle_status` for *each* message. | **CRASH**: DB Write IOPS saturation + Client-side HTTP flood (N+1 problem). |
| **Gift Bomb (50 concurrent)** | Ledger accepts writes fast; Balance updates async. | Ledger accepts writes (Good). Batch processor is **not scheduled**. | **FAILURE**: Gifts accepted but balances never update (Users don't see coins). |
| **HLS Switch (Viral Mode)** | Player switches to Bunny CDN. | Player requests `cdn.maitrollcity.com/...`. Origin pushes to Mux. | **FAILURE**: 404 Errors (Broken Link) unless CDN is manually mapped to Mux. |
| **Malicious Viewer** | Viewer restricted to watch-only. | Viewer requests `allowPublish: true` to Edge Function. | **SECURITY BREACH**: Viewer can publish video/audio to stage. |
| **Leaderboard Load** | Reads from `broadcaster_stats`. | Reads `coin_transactions` (Select All). | **TIMEOUT**: Query takes 10s+ or OOMs on large history. |

## 3. Detailed Findings

### 🔴 Critical: Chat System "DDoS" Architecture
- **File**: `src/components/broadcast/BroadcastChat.tsx`
- **Issue**: 
    1. Writes every message to `stream_messages` (DB).
    2. Realtime listener triggers a `supabase.from('user_profiles').select(...)` AND `supabase.rpc('get_broadcast_vehicle_status')` for **every incoming message**.
- **Impact**: 1000 viewers * 10 msgs/sec = 20,000 HTTP requests/sec to Supabase. Instant rate limit.

### 🔴 Critical: LiveKit Token Security
- **File**: `supabase/functions/livekit-token/index.ts`
- **Issue**: `canPublish` is set to `true` if `params.allowPublish` is true. No server-side role verification restricts this for regular viewers.
- **Impact**: Any user can hijack the stream by modifying the API request.

### 🟠 Major: Unscheduled Gift Processor
- **File**: `supabase/migrations/20270303000006_scalability_update.sql`
- **Issue**: The `process_gift_ledger_batch` function exists and is efficient, but there is no `pg_cron` job or Edge Function scheduled to run it.
- **Impact**: Gifts will remain "pending" indefinitely.

### 🟠 Major: Leaderboard "Select All"
- **File**: `src/lib/leaderboards.ts`
- **Issue**: Fetches all `coin_transactions` for the period and aggregates in JavaScript.
- **Impact**: Will crash the browser or API as transaction history grows.

## 4. Remediation Plan (Immediate Actions)

1.  **Fix LiveKit Security**: Update `livekit-token` to ignore `allowPublish` from client unless user is Admin/Broadcaster.
2.  **Schedule Gift Batch**: Add `pg_cron` job to run `process_gift_ledger_batch` every 10 seconds.
3.  **Refactor Chat**: 
    - Remove `get_broadcast_vehicle_status` from the message loop. Cache it or send it with the message.
    - Switch to Ephemeral Broadcast for non-historical chat.
4.  **Fix HLS URL**: Update `BroadcastPage.tsx` to use the correct Mux Playback ID URL or configure Bunny Pull Zone correctly.
5.  **Rotate Keys**: The `.env` Service Role Key does not match the project URL (`yjxpwfalenorzrqxwmtr`).

