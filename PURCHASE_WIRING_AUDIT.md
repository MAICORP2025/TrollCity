Purchase Wiring Audit
=====================

Summary: lists purchaseable features and whether frontend + backend are wired (no code changes made).

1) Broadcast Frames / Themes
- Frontend: [src/components/broadcast/ThemeSelector.tsx](src/components/broadcast/ThemeSelector.tsx) and [src/pages/perks/PerksStore.tsx](src/pages/perks/PerksStore.tsx)
- Backend: RPC `purchase_broadcast_theme` present in migrations and used by frontend. Seed migration file: [supabase/migrations/20270604000002_seed_premium_frames_and_ceo_perks.sql](supabase/migrations/20270604000002_seed_premium_frames_and_ceo_perks.sql)
- Status: Wired (frontend calls RPC). Note: migration not executed — themes & CEO grant function require running the migration to be active.

2) Perks (user_perks)
- Frontend: [src/pages/perks/PerksStore.tsx](src/pages/perks/PerksStore.tsx), [src/components/broadcast/BroadcastControls.tsx](src/components/broadcast/BroadcastControls.tsx), [src/pages/Profile.tsx](src/pages/Profile.tsx), [src/pages/UserInventory.tsx](src/pages/UserInventory.tsx)
- Backend: `user_perks` table + RPC `shop_buy_perk` / insert into `user_perks` are present across migrations. `deductCoins` (client helper) uses `try_pay_coins_secure` RPC.
- Status: Wired (frontend inserts/updates `user_perks` and uses `deductCoins`). Perk expiry and RLS policies exist in migrations. No further code changes required for basic buy/activate flows.

3) Entrance Effects
- Frontend: multiple (CoinStore, Broadcast Controls, purchase UIs). See [src/pages/CoinStore.jsx](src/pages/CoinStore.jsx) and entrance-effects features.
- Backend: RPCs for `purchase_entrance_effect` / `try_pay_coins_secure` exist in migrations.
- Status: Wired for basic purchase + record. Verify hosted asset URLs and that `user_entrance_effects` rows are consumed by the runtime renderer for other users (rendering depends on broadcast renderer code path).

4) RGB Broadcast (stream RGB)
- Frontend: [src/components/broadcast/BroadcastControls.tsx](src/components/broadcast/BroadcastControls.tsx) (toggleStreamRgb)
- Backend: RPC `purchase_rgb_broadcast` and ledger logging present in migrations.
- Status: Wired (frontend calls coin flow + RPC). Confirm realtime visibility path (the realtime broadcast state must be consumed by viewers' clients).

5) Vehicles / Car Purchases
- Frontend: [src/pages/CarDealership.tsx](src/pages/CarDealership.tsx), [src/pages/NeighborhoodOnboarding.tsx](src/pages/NeighborhoodOnboarding.tsx)
- Backend: `purchase_vehicle` / `purchase_car_v2` RPCs and `deductCoins` usage exist; migrations update purchase_ledger.
- Status: Wired (deductCoins added before RPC in fixes). Needs DB migrations applied (if not already) — verify purchase_ledger wiring on target DB.

6) Insurance (car / property)
- Frontend: [src/pages/TrollerInsurance.tsx](src/pages/TrollerInsurance.tsx), NeighborhoodOnboarding
- Backend: `purchase_insurance` / `purchase_insurance` RPCs and `deductCoins` exist in migrations.
- Status: Wired (frontend calls deductCoins then RPC). Verify policy creation and expiry behavior on DB.

7) Coin Packages / Payments (PayPal / Stripe / Square)
- Frontend/Server: [api/stripe.ts](api/stripe.ts), Edge functions for PayPal fulfillment (see docs). `fulfill-paypal-purchase` exists in edge functions audit.
- Backend: coin_packages, purchase_ledger, coin_transactions support present. Edge functions list in [AUDIT_EDGE_FUNCTION_USAGE.md](AUDIT_EDGE_FUNCTION_USAGE.md)
- Status: Wired (server + edge handlers present). Validate payment provider credentials & sandbox flows before releasing.

8) Listing Premium / Featured Listings
- Frontend: listing premium UI (marketplace flows). See migration references to `purchase_listing_premium`.
- Backend: `purchase_listing_premium` RPC present in migrations.
- Status: Partially wired — RPC exists; ensure frontend routes call it and that purchase_ledger entries are created (some marketplace UI may still be unhooked).

9) Landlord license / property purchases / loans
- Frontend: marketplace / property UIs (various pages). See `buy_property_with_loan`, `purchase_landlord_license` in migrations.
- Backend: RPCs exist in migrations.
- Status: Partially wired — RPCs present; some frontend flows may not call the updated RPC signatures. Recommend quick smoke test.

10) CEO Special: `ceo_gold_premium` -> grant 30-day all-perks
- Frontend: Purchase of theme uses `purchase_broadcast_theme` (ThemeSelector, PerksStore).
- Backend: Migration file [supabase/migrations/20270604000002_seed_premium_frames_and_ceo_perks.sql](supabase/migrations/20270604000002_seed_premium_frames_and_ceo_perks.sql) includes `grant_temporary_all_perks(target_user, days)` function and a trigger `trg_after_theme_purchase` to call it when `ceo_gold_premium` is purchased.
- Status: Semi-wired: frontend will call the same RPC to buy the theme; however the grant function and trigger live only after the migration is executed on the DB. Also verify that `purchase_broadcast_theme` inserts into `user_broadcast_theme_purchases` so the trigger fires.

11) Misc / Other purchasable items (troll pass bundles, featured broadcasts, auction bids, gifts)
- Frontend: Distributed across pages; see `useCoins` usage and many page-level purchases (`TrollsTownPage`, `TrollFamilyChat`, `CoinStore.jsx`).
- Backend: RPCs and ledger logging are present for most items (purchase_ledger, purchase functions). See `MIGRATION_OBJECTS_REPORT.md` for list.
- Status: Mostly wired; gaps exist historically for some niche items. Use `check_all_missing_db_objects.sql` and `check_database_schema.sql` to compare target DB.

Notes & Recommendations
- This audit is read-only. No code changes were made.
- Steps to fully enable everything in a target environment:
  - Run migrations, specifically: `supabase/migrations/20270604000002_seed_premium_frames_and_ceo_perks.sql` to seed themes and create the CEO grant function/trigger.
  - Verify that hosted asset URLs referenced by theme seeds are reachable (preview/background images).
  - Smoke test: buy a `ceo_gold_premium` account in staging and confirm `user_perks` rows are created with `expires_at` ~30 days.
  - Verify realtime propagation: ensure viewer clients read `user_perks` and theme state via `v_broadcast_themes_for_user` or `user_broadcast_theme_state`.

If you want, I can run a targeted code search to expand this into a per-item CSV mapping files → RPCs → status.
