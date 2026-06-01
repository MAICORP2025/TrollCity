# Newest Objects and Features

> Generated: 2026-05-31. Based on file timestamps, migration filenames, and modification dates.

---

## 1. NEWEST MIGRATIONS (by filename timestamp)

The migration filenames use future timestamps (up to 2029), suggesting these were generated programmatically or from a test environment.

| # | Filename | Key Objects Created | Notes |
|---|----------|--------------------|---------|
| 1 | `20290605000000_fix_gift_trollmond_rules.sql` | `send_gift_in_stream()` RPC rewrite, `trollmonds_transferred` column on `stream_gifts` | Complete gift economy overhaul |
| 2 | `20290604000001_fix_jail_notifications_rls.sql` | `jail_notifications` table, RLS policies | New jail notification system |
| 3 | `20290604000000_fix_tromail_calendar_recursion.sql` | 2 helper functions, RLS fix for `tromail_calendar_events` and `tromail_calendar_event_recipients` | Fixes infinite RLS recursion |
| 4 | `20290603000000_fix_tromail_calendar_rls.sql` | RLS policies for tromail calendar | Calendar access control |
| 5 | `20290602000003_fix_audit_logs_user_profiles_relationship.sql` | FK: `audit_logs.user_id -> user_profiles.id` | Schema normalization |
| 6 | `20290602000002_disable_daily_rewards.sql` | N/A (data updates) | Disables daily rewards |
| 7 | `20290602000001_disable_signup_welcome_coins_and_zero_balance.sql` | `handle_new_user_troll_coins()` RPC, `handle_user_signup()` RPC | Zero-balance signups |
| 8 | `20290602000000_buy_featured_promotion.sql` | `buy_featured_promotion()` RPC | Promoted content system |
| 9 | `20290601000010_add_walkie_talkie_page.sql` | `walkie_talkie_page` column on `user_profiles` | Staff walkie talkie |
| 10 | `20290601000000_add_approve_agency_application_atomic.sql` | `approve_agency_application_atomic()` RPC | Agency application system |
| 11 | `20290531000001_customer_service_system.sql` | Customer service tables/policies | CS dashboard |
| 12 | `20290531000000_broadcast_league_system.sql` | Broadcast league tables | League/competition |
| 13 | `20290528010000_tromail_contract_system.sql` | Tromail contract tables | Contracts |
| 14 | `summon_user_to_court_fix.sql` | (root SQL) | Court RPC fix |
| 15 | `remove_coin_exemptions.sql` | (root SQL) | Coin system cleanup |

**Key Theme**: Most recent migrations focus on: gift economy with trollmonds, jail/notifications, tromail calendar, agency system, featured promotions, customer service.

---

## 2. NEWEST FRONTEND FILES (by LastWriteTime)

Most active development is in the broadcast, neighborhood, and admin systems.

| # | File | Last Modified | Feature Area |
|---|------|---------------|-------------|
| 1 | `src/components/modals/ConvertHypeCoinsModal.tsx` | 2026-05-31 04:52 | Hype coin conversion |
| 2 | `src/pages/broadcast/BroadcastPage.tsx` | 2026-05-31 04:47 | Main broadcast page |
| 3 | `src/lib/giftVisuals.ts` | 2026-05-31 04:47 | Gift rendering |
| 4 | `src/pages/broadcast/SetupPage.tsx` | 2026-05-31 04:47 | Stream setup |
| 5 | `src/components/admin/customer-service/SupportScreenSharePanel.tsx` | 2026-05-31 03:49 | Customer service |
| 6 | `src/hooks/useSupportScreenSession.ts` | 2026-05-31 03:46 | Support sessions |
| 7 | `src/components/admin/customer-service/PasswordResetPanel.tsx` | 2026-05-31 03:42 | CS password reset |
| 8 | `src/pages/admin/CustomerServiceDashboard.tsx` | 2026-05-31 03:39 | CS dashboard |
| 9 | `src/pages/admin/adminRoutes.tsx` | 2026-05-31 03:38 | Admin routing |
| 10 | `src/hooks/useCustomerServiceUsers.ts` | 2026-05-31 03:17 | CS user management |
| 11 | `src/hooks/useUserPresenceRoute.ts` | 2026-05-31 03:14 | User presence |
| 12 | `src/App.tsx` | 2026-05-31 03:03 | Main app router (298 routes) |
| 13 | `src/pages/admin/AdminDashboard.tsx` | 2026-05-31 03:01 | Admin dashboard |
| 14 | `src/lib/supabase.ts` | 2026-05-31 02:47 | Core Supabase lib |
| 15 | `src/components/admin/customer-service/UserIssuePanel.tsx` | 2026-05-31 02:44 | CS panel |
| 16 | `src/components/admin/customer-service/UserSupportSelector.tsx` | 2026-05-31 02:44 | CS user selector |
| 17 | `src/lib/hooks/useCityStatusOrb.ts` | 2026-05-31 02:03 | City status |
| 18 | `src/components/broadcast/BroadcastGrid.tsx` | 2026-05-31 01:57 | Broadcast grid |
| 19 | `src/pages/broadcast/ViewerPage.tsx` | 2026-05-31 01:54 | Stream viewer |
| 20 | `src/pages/NeighborhoodOnboarding.tsx` | 2026-05-31 01:44 | Neighborhood |
| 21 | `src/lib/hooks/useNeighborhood.ts` | 2026-05-31 01:41 | Neighborhood hooks |
| 22 | `src/components/broadcast/StreamSwipeCard.tsx` | 2026-05-31 01:39 | Stream swipe |
| 23 | `src/pages/ExploreFeed.tsx` | 2026-05-31 01:39 | Explore feed |
| 24 | `src/components/levels/ProfileLevelWidget.jsx` | 2026-05-31 01:39 | XP/level widget |
| 25 | `src/components/TopBroadcasters.tsx` | 2026-05-31 01:39 | Leaderboard |
| 26 | `src/components/TopBroadcastersGrid.tsx` | 2026-05-31 01:39 | Leaderboard grid |
| 27 | `src/components/city/HouseActionPanel.tsx` | 2026-05-31 01:38 | House raids |
| 28 | `src/components/city/CityStatusPanel.tsx` | 2026-05-31 01:35 | City status |
| 29 | `src/components/city/CityStatusOrb.tsx` | 2026-05-31 01:34 | City orb |
| 30 | `src/lib/hooks/useHouseRaidActions.ts` | 2026-05-31 01:32 | House raids |

**Key Theme**: Most active development on: Customer service dashboard, broadcast features, neighborhood/city system, gift economy, admin routing. Everything modified today (2026-05-31) is the primary focus.

---

## 3. NEWEST EDGE FUNCTIONS (by LastWriteTime)

| # | Function | Last Modified | Purpose |
|---|----------|---------------|---------|
| 1 | `customer-service-admin` | 2026-05-31 03:49 | CS admin operations |
| 2 | `paypal-payout` | 2026-05-30 06:06 | PayPal payout processing |
| 3 | `agora-walkie-token` | 2026-05-30 03:25 | Walkie talkie tokens |
| 4 | `admin-actions` | 2026-05-29 23:04 | Admin operations |
| 5 | `process-payout-batch` | 2026-05-28 21:08 | Payout batch processing |
| 6 | `agora-token` | 2026-05-27 21:17 | Agora tokens |
| 7 | `vote-for-officer` | 2026-05-24 16:17 | Officer elections |
| 8 | `verify-square-payment` | 2026-05-24 16:17 | Square payment verification |
| 9 | `verify-paypal-payment` | 2026-05-24 16:17 | PayPal verification |
| 10 | `user-agreements` | 2026-05-24 16:17 | Terms acceptance |

---

## 4. MIGRATION DATE RANGE

| Metric | Value |
|--------|-------|
| Oldest migration filename | `20230101000000_baseline.sql` |
| Newest migration filename | `20290605000000_fix_gift_trollmond_rules.sql` |
| Total migration files (supabase/migrations/) | 403 |
| Backup migrations (migrations_backup/) | 100+ |
| Extra migrations (migrations/) | 7 |
| Database migrations (database/migrations/) | 10 |
| Root-level ad-hoc SQL files | ~180+ |

**Note**: Future-dated migrations (2027-2029) suggest programmatic generation or a long-term roadmapped schema. These may not have been applied to the actual database yet.

---

## 5. MIGRATIONS WITH CLEANUP/REMOVE KEYWORDS

| File | Action |
|------|--------|
| `drop_unused_tables.sql` | Lists tables for potential removal |
| `remove_coin_exemptions.sql` | Removes coin exemption config |
| `disable_rls_globally.sql` | Disables RLS (emergency use) |
| `DATABASE_CLEANUP_ANALYSIS.md` | Analysis of what to remove |
| `DATABASE_CLEANUP_COMPREHENSIVE_REPORT.md` | Results of prior cleanup |

---

## 6. NEWEST FEATURES ADDED (Based on Recent Code Changes)

From the 2026-05-31 code changes:

1. **Customer Service Dashboard** — Complete CS system with user issue panel, password reset, screen share, support sessions
2. **Hype Coin Conversion** — ConvertHypeCoinsModal for converting hype coins
3. **Gift Economy v2** — Trollmonds transfer system in `send_gift_in_stream()`
4. **Jail Notifications** — `jail_notifications` table with RLS
5. **Tromail Calendar** — Calendar events with RLS fix
6. **Featured Promotions** — Buy featured placement for broadcasts/podcasts/posts
7. **Agency System** — Approve agency applications, billing events, member management
8. **Broadcast League System** — League stats and rankings
9. **Staff Walkie Talkie** — Walkie talkie page assignments
10. **Admin Route Refactoring** — adminRoutes.tsx rewritten today

---

## 7. KEY OBSERVATIONS

1. **The codebase is under very active development** — 30+ files modified today (2026-05-31).
2. **Customer Service is the newest major feature set** — entirely new dashboard with edge functions added today.
3. **Gift economy is being redesigned** — trollmonds system added in newest migrations.
4. **Admin routing is being refactored** — adminRoutes.tsx modified today with 28 dynamic routes.
5. **The migration naming scheme** uses future dates (2027-2029) which complicates determining actual chronological order.
6. **Zero files were modified between 2026-05-24 and 2026-05-27** — suggesting a pause in development.
7. **All recent edge function changes are admin-facing** — customer-service-admin, paypal-payout, admin-actions.
