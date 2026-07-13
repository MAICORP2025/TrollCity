# TODO — Admin-only Supabase Usage & Cost Dashboard (Troll City)

## Plan confirmation
- [x] Reviewed repo structure: React admin pages + central `adminRoutes.tsx`.
- [x] Confirmed need for server-side auth enforcement for every admin endpoint.

## Implementation steps
1. [x] Create centralized pricing config file `SUPABASE_PRICING` (no duplicated pricing elsewhere).
2. [x] Implement pure cost calculation utilities using the provided formulas.
3. [x] Add Jest unit tests for cost utilities.
4. [x] Add database migration for `public.admin_supabase_metric_snapshots` with:
   - [x] RLS enabled
   - [x] Server-only select/insert/update policies
   - [x] Indexes on `project_key` and `captured_at`
   - [x] Bounded retention handling
5. [x] Implement secure server-side metrics layer:
   - [x] New Express endpoints under `server/` for summary, breakdown, historical, refresh
   - [x] JWT session verification + admin role check on every endpoint
   - [x] No secrets exposed to client
   - [x] Short caching (summary) + bounded historical query limits
   - [x] Rate limiting for endpoints
   - [x] Historical range allowlist: `24h | 7d | 30d | billing_period`
6. [x] Add admin route + navigation link:
   - [x] Update `src/pages/admin/adminRoutes.tsx` for `/admin/supabase-usage`
   - [x] Create dashboard page component (view-only)
7. [ ] Implement dashboard UI sections per spec:
   - [ ] Executive summary cards + status badges + billing period dates
   - [ ] Estimated monthly cost breakdown table with confidence/source fields
   - [ ] Database & compute section
   - [ ] Storage & CDN section (bucket breakdown)
   - [ ] Auth metrics section (no PII)
   - [ ] Realtime section + charts
   - [ ] Page/feature activity section from Troll City telemetry only
   - [ ] Projections & upgrade guidance with explicit thresholds
   - [ ] Historical charts with time filters
   - [ ] Alerts panel + configurable warning budget (DB-backed)
   - [ ] Loading/empty/unavailable/stale/error states
8. [x] Add snapshot refresh flow:
   - [x] Manual Refresh button calls server refresh endpoint
   - [x] Refresh endpoint stores new snapshots but does not modify Supabase configuration
9. [x] Add documentation + verification checklist:
   - [x] `ADMIN_SUPABASE_USAGE_DASHBOARD.md`
   - [x] List metrics sources and which remain unavailable
10. [ ] Run checks:
   - [x] `npm test` (or narrowed jest)
   - [ ] `npm run check` (tsc)
   - [ ] `npm run build` (or available build checks)

## Progress
- Initial repo exploration completed.

