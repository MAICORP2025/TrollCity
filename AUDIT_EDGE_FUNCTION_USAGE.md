# Edge Function & API Route Usage Audit

> Generated: 2026-05-31. 114 edge functions, 22 Vercel API routes, 5 Express routes.
> 42 of 114 edge functions (~37%) are invoked from the frontend.

---

## EDGE FUNCTIONS CALLED FROM FRONTEND

### Streaming / Live

| Function | Tables | RPCs | Storage | Auth |
|----------|--------|------|---------|------|
| `livekit-token` | stream_stage_passes (select) | - | - | Admin |
| `agora-token` | - | - | - | Admin |
| `agora-walkie-token` | - | - | - | Admin |
| `streams-maintenance` | streams (select,update), battles (select), user_profiles (select), streams_participants (delete) | - | - | Admin |
| `live` | user_profiles (select,update), streams (insert), user_follows | - | - | Admin |
| `go-live-mark-live` | live_sessions (select,update) | - | - | Admin |
| `go-live-refund-hd-boost` | live_sessions, wallet_transactions | troll_bank_credit_coins | - | Admin |

### Payments / Economy

| Function | Tables | RPCs | Storage | Auth |
|----------|--------|------|---------|------|
| `create-paypal-order` | - | - | - | Admin |
| `paypal-complete-order` | paypal_transactions (select,update) | - | - | Admin |
| `verify-paypal-payment` | - | - | - | Admin |
| `paypal-payout` | payout_requests (select,update), coin_ledger (insert) | - | - | Admin |
| `paypal-create-order` | - | check_rate_limit | - | Admin |
| `fulfill-paypal-purchase` | coin_packages, paypal_transactions, purchase_ledger, coin_transactions | troll_bank_credit_coins | - | Admin |
| `create-square-checkout` | - | - | - | Admin |
| `charge-stored-card` | user_payment_methods, user_profiles, purchasable_items, purchase_ledger, coin_transactions | - | - | Admin |
| `verify-square-payment` | user_profiles, user_payment_methods, purchasable_items, purchase_ledger, coin_transactions | - | - | Admin |
| `save-card` | user_profiles, user_payment_methods | - | - | Admin |
| `square-save-card` | user_profiles | - | - | Admin |
| `square-webhook` | (delegates to verify-square-payment) | - | - | Webhook |
| `manual-coin-order` | user_profiles, manual_coin_orders, notifications, admin_pool, wallets | check_rate_limit, apply_troll_pass_bundle, troll_bank_credit_coins | - | Admin |
| `process-payout-batch` | user_profiles, payout_batches, payout_requests | - | - | Admin |

### Admin Operations

| Function | Tables | RPCs | Storage | Auth |
|----------|--------|------|---------|------|
| `admin` | user_profiles, app_settings, earnings_payouts, payout_requests, support_tickets | - | - | Admin |
| `admin-actions` | user_profiles, payout_requests, applications, coin_packages, coin_transactions, executive_intake, interview_sessions, manual_coin_orders, support_tickets | is_lead_officer_position_filled | - | Admin |
| `admin-reset` | user_profiles, streams, streams_participants | - | - | Admin |
| `admin-stats` | profiles, applications, payout_requests, coin_transactions, earnings_payouts, admin_flags, punishment_fines, sav_promotions | - | - | Admin |
| `admin-stock-manager` | user_profiles, stocks, user_portfolio | - | - | Admin |
| `adminScheduler` | scheduled_announcements, admin_broadcasts | - | - | Admin |
| `customer-service-admin` | user_profiles, admin_password_resets, customer_service_audit_logs | - | - | Admin |

### Social / Ads / Content

| Function | Tables | RPCs | Storage | Auth |
|----------|--------|------|---------|------|
| `capture-content` | source_content_refs, ad_assets | - | ad-assets | Admin |
| `generate-ad` | source_content_refs, ad_generation_jobs, ad_assets, ad_videos | - | ad-assets | Admin |
| `publish-social` | social_publish_queue, connected_social_accounts, social_publish_logs | - | - | Admin |
| `social-oauth-init` | - | - | - | Admin |
| `social-oauth-callback` | connected_social_accounts | - | - | Webhook |

### Communications

| Function | Tables | RPCs | Storage | Auth |
|----------|--------|------|---------|------|
| `send-announcement` | user_profiles, notifications | - | - | Admin |
| `send-bulk-notifications` | user_profiles, notifications | - | - | Admin |
| `global-ticker-notify` | user_profiles, notifications | - | - | Admin |
| `sendEmail` | - | - | - | Admin |
| `push-notifications` | web_push_subscriptions, user_profiles, push_notification_logs | - | - | Admin |
| `magicbell-jwt` | user_profiles | - | - | Admin |

### Officer / Moderation

| Function | Tables | RPCs | Storage | Auth |
|----------|--------|------|---------|------|
| `officer-actions` | user_profiles, officer_timesheets, officer_warrants, officer_chat_messages, officer_time_off_requests, admin_audit_logs, applications, streams_participants | - | - | Admin |
| `toggle-ghost-mode` | user_profiles, officer_live_assignments | - | - | Admin |
| `submit-training-response` | training_scenarios, officer_training_sessions | - | - | Admin |
| `get-training-scenario` | training_scenarios | - | - | Admin |

### User Operations

| Function | Tables | RPCs | Storage | Auth |
|----------|--------|------|---------|------|
| `password-manager` | user_profiles | - | - | Admin |
| `user-agreements` | user_profiles, user_agreements, agreement_stats | - | - | Admin |
| `delete-account` | user_profiles, notifications, account_deletion_reasons, auth.users, coin_ledger, friend_requests, moderation_cases, neighbors, stream_chat, stream_gifts, stream_likes, stream_reports, stream_seats, stream_viewers, streams, troll_families, troll_family_members, user_reports | - | - | Admin |
| `delete-user-account` | user_profiles, streams, admin_notifications | - | - | Admin |
| `report-bug` | profiles, bug_alerts | - | - | Admin |
| `dismiss-notification` | notifications | - | - | Admin |
| `update-notification-preferences` | user_profiles | - | - | Admin |

### Games / Battles

| Function | Tables | RPCs | Storage | Auth |
|----------|--------|------|---------|------|
| `battles` | streams, battles, streams_participants, user_profiles | - | - | Admin |
| `troll-battle` | troll_battles, troll_battle_gifts, battle_history, battle_rewards | - | - | Admin |
| `troll-us-game` | games, game_players, game_votes, streams | - | - | Admin |
| `universal-battle` | streams, stream_seats | - | - | Admin |
| `evaluate-missions` | stream_missions, user_badges | - | - | Admin |
| `troll-events` | streams, troll_events, troll_event_claims, user_profiles | - | - | Admin |

### Mai Talent

| Function | Tables | RPCs | Storage | Auth |
|----------|--------|------|---------|------|
| `mai-talent-v2-orchestrator` | mai_queue, mai_show_sessions, mai_stage_slots | fill_stage_slot, leave_stage_and_fill_next | - | Admin |
| `mai-talent-timer-watcher` | mai_performance_timer | leave_stage_and_fill_next | - | Admin |
| `select-winner` | mai_talent_votes | - | - | Admin |

### Cron/Webhook Only (NOT called from frontend)

| Function | Purpose |
|----------|---------|
| `cron-tasks` | Maintenance: decay_broadcast_levels, process_admin_queue, check_loan_defaults, auto_release_inmates, etc. |
| `auto-clock-out` | Auto clock-out officers |
| `officer-auto-clockout` | Another officer auto clock-out |
| `credit-daily-maintenance` | Credit system maintenance |
| `credit-loan-handler` | Loan handler |
| `credit-record-event` | Credit event recording |
| `process-referral-bonuses` | Referral bonus processing |
| `process-offline-notifications` | Offline notification processing |
| `ai-detect-ghost-inactivity` | Ghost mode inactivity detection |
| `livekit-webhooks` | LiveKit webhook handler |
| `paypal-webhook` | PayPal webhook handler |
| `apply-punishment` | Punishment application |
| `shadow-ban-user` | Shadow banning |
| `expire-officer-roles` | Officer role expiration |
| `close-officer-vote-cycle` | Officer vote cycle closure |
| `start-officer-vote-cycle` | Officer vote cycle start |
| `vote-for-officer` | Officer voting |
| `complete-ghost-mission` | Ghost mission completion |
| `log-moderation-event` | Moderation event logging |
| `trollcourt-ai` | Court AI |
| `gemini-verify-user` | Gemini verification |
| `ai-verify-user` | AI verification |
| `moderation` | Moderation actions |
| `send-message` | Stream message sending |
| `send-like` | Stream like |
| `bank-apply` | Bank application |
| `bank-credit` | Bank credit |
| `loan-payment` | Loan payment |
| `award-badge` | Badge awarding |
| `evaluate-badges-for-event` | Badge evaluation |
| `end-home-feature-cycle` | Home feature cycle |
| `broadcast-seats` | Broadcast seat management |
| `create-square-customer` | Square customer creation |
| `get-training-scenario` | (also called from frontend) |
| `process-audio-queue` | Audio queue |
| `process-audio-safety` | Audio safety |
| `track-guest` | Guest tracking |
| `store-user-geolocation` | Geolocation storage |
| `paypal-verify-transaction` | PayPal verification (server-side) |
| `create-paypal-order` | (also called from frontend via fetch) |
| `payments` | Payment processing |
| `payments-status` | Payment status |
| `live` | Live stream creation |
| `credit-small-purchase-milestone` | Installment milestone |
| `stock-gamification` | Stock gamification |
| `stock-price-engine` | Stock price engine |
| `auth` | Auth handling |
| `ping` | Health check |
| `platform-fees` | Fee processing |
| `verify-user-complete` | Deprecated (410) |

---

## VERCEL API ROUTES

| Route | File | Tables | Operations |
|-------|------|--------|-------------|
| `/api/upload` | api/upload.ts | - | Bunny Storage (external) |
| `/api/tracking-webhook` | api/tracking-webhook.ts | order_shipments, marketplace_purchases, notifications | select, insert |
| `/api/tracking-refresh` | api/tracking-refresh.ts | marketplace_purchases, tracking_events | select, update |
| `/api/telemetry` | api/telemetry.ts | telemetry_events | insert |
| `/api/stripe/webhook` | api/stripe/webhook.ts | coin_orders | select, update, credit_coins RPC |
| `/api/stripe/set-default-payment-method` | api/stripe/set-default-payment-method.ts | user_payment_methods | update |
| `/api/stripe/save-payment-method` | api/stripe/save-payment-method.ts | stripe_customers, user_payment_methods | select, insert, update |
| `/api/stripe/delete-payment-method` | api/stripe/delete-payment-method.ts | user_payment_methods | delete |
| `/api/stripe/create-setup-intent` | api/stripe/create-setup-intent.ts | stripe_customers | select |
| `/api/stripe/create-checkout-session` | api/stripe/create-checkout-session.ts | coin_packages, stripe_customers, coin_orders | select, insert |
| `/api/stripe` | api/stripe.ts | coin_orders, coin_packages, stripe_customers, user_payment_methods | select, insert, update |
| `/api/social/[id]` | api/social/[id].ts | streams, user_profiles | select |
| `/api/platform-fees` | api/platform-fees.ts | platform_fees | select, insert |
| `/api/payouts` | api/payouts.ts | payouts | select, insert |
| `/api/payout-request` | api/payout-request.ts | payout_requests | select, insert |
| `/api/payout-reject` | api/payout-reject.ts | payout_requests | select, update |
| `/api/payout-approve` | api/payout-approve.ts | payout_requests | select, update |
| `/api/organizations/dashboard` | api/organizations/dashboard/index.ts | user_profiles, organizations, organization_students, organization_admins, organization_members, mai_class_enrollments | select |
| `/api/mai-class/start` | api/mai-class/start.ts | user_profiles, mai_classes | select, insert |
| `/api/mai-class/end` | api/mai-class/end.ts | user_profiles, mai_classes | select, update |
| `/api/mai-class/create` | api/mai-class/create.ts | user_profiles, mai_classes | select, insert |
| `/api/mai-class/active-class` | api/mai-class/active-class.ts | mai_classes, mai_class_enrollments, user_profiles | select |

---

## EXPRESS SERVER ROUTES

| Route | File | Tables | Operations |
|-------|------|--------|-------------|
| `POST /api/broadcasts/start-streaming` | server/api/broadcasts.js | streams, user_profiles, troll_wall_posts | select, insert, update |
| `POST /api/broadcasts/stop-streaming` | server/api/broadcasts.js | streams, troll_wall_posts | select, update, delete |
| `GET /api/broadcasts/:streamId/status` | server/api/broadcasts.js | streams | select |
| `POST /api/telemetry` | server/api/telemetryHandler.js | telemetry_events | insert |
| `GET /health` | server/index.ts | - | - |
