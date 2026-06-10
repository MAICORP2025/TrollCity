# DATABASE_MAP.md — Troll City Table Relationship Map

> Generated: 2026-06-09

---

## Entity-Relationship Diagram (Text)

```
auth.users (Supabase Auth)
  ├─ user_profiles (1:1)
  │    ├─ user_levels (1:1)
  │    ├─ user_credit (1:1)
  │    ├─ wallet_transactions (1:N)
  │    ├─ coin_transactions (1:N)
  │    ├─ bank_accounts (1:N)
  │    ├─ user_bank_loans (1:N)
  │    ├─ user_cars (1:N)
  │    ├─ manual_orders (1:N)
  │    ├─ payout_requests (1:N)
  │    ├─ paypal_transactions (1:N)
  │    ├─ insurance_plans (1:N)
  │    ├─ reports (1:N)
  │    └─ blocked_users (1:N)
  │
  ├─ families (creator) ──┐
  │    ├─ family_members (N:M)
  │    ├─ family_invites (1:N)
  │    ├─ family_wars (1:N)
  │    └─ family_chat (1:N)
  │
  ├─ broadcasts (creator) ──┐
  │    ├─ broadcast_analytics (1:N)
  │    ├─ broadcast_seats (1:N)
  │    ├─ broadcast_chat_messages (1:N)
  │    ├─ stream_sessions (1:N)
  │    └─ broadcast_themes (N:1)
  │
  ├─ posts (creator) ──┐
  │    ├─ comments (1:N)
  │    ├─ post_reactions (1:N)
  │    └─ post_media (1:N)
  │
  ├─ agencies (creator) ──┐
  │    ├─ agency_members (N:M)
  │    ├─ agency_invites (1:N)
  │    ├─ agency_applications (1:N)
  │    └─ agency_earnings (1:N)
  │
  ├─ organizations (creator) ──┐
  │    ├─ organization_members (N:M)
  │    └─ organization_files (1:N)
  │
  ├─ jail (inmate) ──┐
  │    ├─ jail_bail (1:N)
  │    └─ appeals (1:N)
  │
  ├─ court_dockets ──┐
  │    ├─ court_cases (1:N)
  │    └─ court_rulings (1:N)
  │
  ├─ officers ──┐
  │    ├─ officer_shifts (1:N)
  │    ├─ officer_reports (1:N)
  │    ├─ officer_assignments (1:N)
  │    └─ officer_time_off (1:N)
  │
  ├─ election_cycles ──┐
  │    ├─ candidates (1:N)
  │    └─ votes (1:N)
  │
  ├─ academy_courses ──┐
  │    ├─ academy_enrollments (1:N)
  │    ├─ academy_assignments (1:N)
  │    ├─ academy_quizzes (1:N)
  │    ├─ academy_attendance (1:N)
  │    ├─ academy_certificates (1:N)
  │    ├─ academy_grades (1:N)
  │    └─ academy_transcripts (1:N)
  │
  ├─ conversations ──┐
  │    ├─ conversation_members (N:M)
  │    └─ messages (1:N)
  │
  ├─ notifications (recipient)
  │
  ├─ events ──┐
  │    ├─ event_participants (N:M)
  │    └─ event_registrations (1:N)
  │
  ├─ church_sermons
  ├─ church_live_sessions
  ├─ church_prayers
  │
  ├─ tromail_messages
  ├─ utromail_messages
  │
  ├─ tcnn_articles ──┐
  │    ├─ tcnn_article_revisions (1:N)
  │    └─ tcnn_live_streams (1:N)
  │
  ├─ battles ──┐
  │    └─ battle_participants (N:M)
  │
  ├─ stock_trades
  ├─ stock_portfolios
  │
  ├─ store_items ──┐
  │    └─ store_purchases (1:N)
  │
  ├─ property ──┐
  │    ├─ property_insurance (1:N)
  │    └─ rental_marketplace (1:N)
  │
  ├─ announcements
  ├─ tcnn_ticker_queue
  ├─ tcnn_breaking_alerts
  ├─ shareathon_entries
  ├─ troll_city_treasury
  ├─ vehicle_asset_system
  ├─ shareathon_verifications
  └─ bug_center_bugs
```

---

## Migration Statistics

| Category | Count |
|---|---|
| Active migrations | ~100+ |
| Backup migrations (not applied) | ~400+ |
| Conflicted migrations (not applied) | ~10 |
| Pending/ignored migrations | ~9 |
| Total migration files | 898 |

### Critical Migration Directories

- `supabase/migrations/` — Active migrations directory
- `supabase/migrations_backup/` — Deprecated migrations (DO NOT APPLY)
- `supabase/migrations_conflicted_backup/` — Conflicted migrations (DO NOT APPLY)
- `supabase/migrations/pending_ignored/` — Pending review (DO NOT APPLY without review)

---

## RLS Policy Coverage

The following tables have Row Level Security policies:

| Table Category | RLS Enabled | Policy Count |
|---|---|---|
| User data tables | ✅ Yes | ~15 |
| Content tables | ✅ Yes | ~10 |
| Economy tables | ✅ Yes | ~10 |
| Institution tables | ✅ Yes | ~8 |
| System tables | ✅ Yes | ~7 |
| **Total** | **~50+ tables** | **~50+ policies** |
