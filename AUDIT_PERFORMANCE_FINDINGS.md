# Performance Findings

> Generated: 2026-05-31. Based on static code analysis of src/ directory.
> Severity: CRITICAL | HIGH | MEDIUM | LOW

---

## 1. REPEATED PAGE-LOAD QUERIES (No Caching)

### 1a. CRITICAL — useAdminDashboardMetrics: 4+ full table scans every mount

- **File**: `src/hooks/useAdminDashboardMetrics.ts:185-190`
- **Pattern**: useEffect with [] deps calls `loadMetrics()` on every mount. No `useQuery`, no `staleTime`, no shared cache.
- **Impact**: Transactions table scan, user_profiles count, streams select, coins aggregation — all re-fire on every admin navigation.
- **Fix**: Wrap in `useQuery` with staleTime/gcTime. Add date-range filter to limit transaction scan.

### 1b. CRITICAL — EconomyDashboard: entire coin_transactions table scan client-side

- **File**: `src/pages/admin/EconomyDashboard.tsx:45`
- **Pattern**: `.from('coin_transactions').select(...).or(COIN_PURCHASE_ROWS_OR).order(...)` — no date filter, no limit.
- **Impact**: For millions of rows, this will timeout or OOM the browser. Plus fetches all user_profiles for buyer IDs, unbounded creators_over_600 view.
- **Fix**: Replace client-side aggregation with an RPC or materialized view. Add date-range filter.

### 1c. HIGH — AdminDashboard.loadCoinPurchases: 3-table scan every 30s

- **File**: `src/pages/admin/AdminDashboard.tsx:581-748`
- **Pattern**: Queries transactions, coin_store_sales, paypal_transactions (limit 2000 each), then user_profiles for all matched IDs.
- **Impact**: Up to 6000 rows merged/deduped client-side every 30 seconds.
- **Fix**: Create a single RPC or view for consolidated purchase data.

### 1d. HIGH — Profile.tsx: 9 parallel SELECTs + N+1 follow-ups

- **File**: `src/pages/Profile.tsx:221-258`
- **Pattern**: Promise.all of 9 selects (user_perks, user_entrance_effects, user_insurances, call_minutes, properties, vehicle_listings, marketplace_items, user_vehicles, user_inventory), then supplementary queries for marketplace_item titles and insurance plan details.
- **Impact**: First batch is OK (parallel), but follow-up queries create N+1. All use `select('*')`.
- **Fix**: Narrow select columns. Consolidate related data via RPC or server-side join.

### 1e. MEDIUM — AdminFinanceDashboard: duplicate economy_summary fetch

- **File**: `src/pages/admin/AdminFinanceDashboard.tsx:39-47`
- **Pattern**: Fetches `economy_summary` independently even though `useAdminFinanceRealtime` already does the same.
- **Impact**: Redundant full-table scans for same data.
- **Fix**: Share data via Zustand store or React Query cache.

---

## 2. UNBOUNDED SELECTS (no `.limit()`)

### 2a. CRITICAL — EconomyDashboard coin_transactions

- **File**: `src/pages/admin/EconomyDashboard.tsx`
- **Issue**: No date filter, no `.limit()`. The largest table in the system scanned entirely client-side.
- **Fix**: RPC with server-side aggregation.

### 2b. MEDIUM — AdminPayoutMobile: unbounded payout_requests and visa_redemptions

- **File**: `src/pages/admin/AdminPayoutMobile.tsx:34-58`
- **Issue**: `.select("*").order(...)` with no limit.
- **Fix**: `.limit(200)` with pagination.

### 2c. MEDIUM — useRealtimeStreams: unbounded streams query

- **File**: `src/pages/admin/hooks/useRealtimeStreams.ts:16-22`
- **Issue**: All stream records fetched. Polled every 30s.
- **Fix**: `.limit(100)` + filter to `status.eq.live` or recent.

### 2d. LOW — useRealtimeUsers: hardcoded limit(500)

- **File**: `src/pages/admin/hooks/useRealtimeUsers.ts:16-23`
- **Issue**: Hardcoded limit but no filter. Always fetches 500 rows.
- **Fix**: Reduce limit or add search/filter.

### 2e. HIGH — useAdminDashboardMetrics: all user_profiles for SUM

- **File**: `src/hooks/useAdminDashboardMetrics.ts:167`
- **Issue**: `SELECT troll_coins FROM user_profiles` — fetches every row to sum client-side.
- **Fix**: `SELECT SUM(troll_coins) FROM user_profiles` via RPC.

---

## 3. N+1 QUERY PATTERNS

### 3a. Profile.tsx fetchInventory

- **File**: `src/pages/Profile.tsx:221-258`
- **Pattern**: 9 parallel queries, then detail queries for marketplace items and insurance plans.
- **Impact**: N+1 on inventory items.

### 3b. AdminDashboard economy fallback

- **File**: `src/pages/admin/AdminDashboard.tsx:786-863`
- **Pattern**: 4 sequential table scans (transactions, paypal_transactions, earnings_payouts, coin_transactions) with client-side aggregation.
- **Impact**: Deep fallback path scans 4 large tables.

---

## 4. REALTIME CHANNEL LEAKS

### 4a. MEDIUM — EarningsPayout: channel recreate loop

- **File**: `src/pages/EarningsPayout.tsx:114-123`
- **Pattern**: `loadRecent` not wrapped in `useCallback`, causing effect to re-run every render, tearing down and recreating channel.
- **Impact**: Channel churn, missed events during re-subscribe windows.
- **Fix**: Wrap `loadRecent` in `useCallback`.

### 4b. LOW — useTrollToe: orphan subscription

- **File**: `src/hooks/useTrollToe.ts:30-38`
- **Pattern**: Subscribes to `stream:${streamId}` but never attaches `.on()` handlers. Creates a wasted realtime connection.
- **Fix**: Remove the subscription or add event handlers.

---

## 5. DUPLICATE REALTIME SUBSCRIPTIONS

### 5a. HIGH — useAdminFinanceRealtime vs useAdminDashboardMetrics

- **Files**: `hooks/useAdminFinanceRealtime.ts` and `hooks/useAdminDashboardMetrics.ts`
- **Issue**: Both used by AdminDashboard, both fetch overlapping data (user_profiles count, transactions, streams, coins).
- **Fix**: Consolidate into single hook or use shared query cache.

### 5b. HIGH — AdminDashboard: 3 layers of duplicate fetching

- **File**: `src/pages/admin/AdminDashboard.tsx`
- **Issue**: Component independently fetches data that both `useAdminFinanceRealtime` and `useAdminDashboardMetrics` already provide.
- **Fix**: Centralize admin dashboard data fetching.

### 5c. MEDIUM — BroadcastPage: 4 separate channel subscriptions

- **File**: `src/pages/broadcast/BroadcastPage.tsx` (lines 2252, 2726, 3625, 3777)
- **Issue**: 4 channels with separate WebSocket subscriptions instead of one multiplexed channel.
- **Fix**: Consolidate onto a single channel.

### 5d. HIGH — BattleView: 6+ channels per participant

- **File**: `src/components/broadcast/BattleView.tsx` (lines 2528, 2556, 2575, 2698, 2715, 2773, 3209)
- **Issue**: Each battle participant opens 6+ channels. 10 participants = 60+ subscriptions.
- **Fix**: Multiplex all battle subscriptions onto one channel.

### 5e. LOW — useGovernmentSystem: 4 global channels

- **File**: `src/hooks/useGovernmentSystem.ts` (lines 261, 284, 693, 715)
- **Issue**: 4 global channels (laws, votes, protests, history) should be one multiplexed channel.
- **Fix**: Single channel with multiple `.on()` handlers.

### 5f. LOW — useCoins: 2 channels per user

- **File**: `src/lib/hooks/useCoins.ts` (lines 308, 381)
- **Issue**: `coin-balance-updates:{userId}` and `profile-balance-updates:{userId}` — should be one channel.
- **Fix**: Single multiplexed channel.

---

## 6. FULL-PAGE REMOUNT / LOADING SPINNER

### 6a. MEDIUM — App.tsx: Suspense fallback is null

- **File**: `src/App.tsx:1174`
- **Pattern**: `<Suspense fallback={null}>` — blank screen during code-split navigation.
- **Fix**: Use a meaningful fallback (skeleton or spinner).

### 6b. MEDIUM — AdminDashboard: spinner on every mount

- **File**: `src/pages/admin/AdminDashboard.tsx:1173-1183`
- **Pattern**: Full-page spinner on every remount even though store may already have data.
- **Fix**: Use skeleton UI or stale-while-revalidate.

### 6c. MEDIUM — Profile.tsx: spinner every navigation

- **File**: `src/pages/Profile.tsx:729-741`
- **Pattern**: Loading state starts as true every mount, no stale data retention.
- **Fix**: Stale-while-revalidate pattern.

### 6d. LOW — AdminFinanceDashboard: refresh resets loading

- **File**: `src/pages/admin/AdminFinanceDashboard.tsx:94-98`
- **Pattern**: 60-second refetch resets loading state, showing spinner over existing data.
- **Fix**: Only show spinner on first load.

---

## 7. REPEATED ADMIN METRICS (Cross-Page Duplication)

### 7a. HIGH — economy_summary fetched by 5 independent sources

| File | Interval |
|------|----------|
| `AdminDashboard.loadEconomySummary` | On mount |
| `AdminFinanceDashboard.loadSummary` | On mount + 60s |
| `useAdminDashboardMetrics.loadCoinPurchaseMetrics` | On mount + 60s |
| `EconomyDashboard` | On mount + 60s |
| `useAdminFinanceRealtime` | Via RPC/useQuery |

- **Fix**: Single shared data source (Zustand store or React Query with common key).

### 7b. MEDIUM — AdminEarningsDashboard: unbounded earnings_view

- **File**: `src/pages/admin/AdminEarningsDashboard.tsx:81-84`
- **Pattern**: `SELECT * FROM earnings_view ORDER BY...` with no limit.
- **Fix**: Add `.limit(100)` with pagination.

### 7c. HIGH — Double coin_transactions scan

- **Files**: `AdminDashboard.loadCoinPurchases` and `EconomyDashboard`
- **Issue**: Both independently scan coin_transactions with no date filter. If both open simultaneously, double the load.
- **Fix**: Consolidate.

---

## 8. MISSING INDEXES ON HOT QUERY PATTERNS

Based on query patterns observed, ensure these indexes exist:

| Table | Column(s) | Query Pattern |
|-------|-----------|--------------|
| `coin_transactions` | `created_at, type, source` | Admin economy dashboard filters |
| `coin_transactions` | `user_id, created_at` | Transaction history per user |
| `transactions` | `created_at` | Load coin purchases |
| `payout_requests` | `status, created_at` | Payout queue listing |
| `stream_messages` | `stream_id, created_at` | Chat loading |
| `notifications` | `user_id, is_read, created_at` | Notification listing |
| `user_follows` | `follower_id, followed_id` | Follow check |
| `user_profiles` | `username` | Profile lookup |
| `user_profiles` | `email` | Auth setup |
| `streams` | `broadcaster_id, status` | Stream status check |
| `court_cases` | `status, created_at` | Court listing |

---

## SUMMARY

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Repeated queries | 2 | 2 | 1 | 0 |
| Unbounded selects | 1 | 1 | 2 | 1 |
| N+1 patterns | 0 | 1 | 1 | 0 |
| Channel leaks | 0 | 0 | 1 | 1 |
| Duplicate subscriptions | 0 | 3 | 2 | 1 |
| Loading spinner issues | 0 | 0 | 3 | 1 |
| Cross-page duplication | 0 | 2 | 1 | 0 |
| **TOTAL** | **3** | **9** | **11** | **4** |

**Top 5 Recommendations** (NOT executed, just suggested):

1. **Replace all client-side economy aggregation with RPCs or materialized views** — single biggest performance win
2. **Add React Query with staleTime to admin dashboard hooks** — eliminates redundant queries
3. **Add limits and date filters to all unbounded selects** — prevents scaling issues
4. **Consolidate realtime channels per feature (1 per stream, 1 per battle, 1 per admin dashboard)** — reduces connection count
5. **Implement stale-while-revalidate for Profile and Admin dashboards** — eliminates jarring spinner flashes
