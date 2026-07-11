# Supabase Edge Functions Inventory

Generated: 2026-07-10

## Local Functions by Status

| # | Function | Status | Notes |
|---|----------|--------|-------|
| 1 | add-card | USED | Invoked in code |
| 2 | admin | USED | Invoked in code |
| 3 | admin-actions | USED | Invoked in code |
| 4 | agora-stream | USED | Invoked in code |
| 5 | agora-token | USED | Invoked in code |
| 6 | agora-walkie-token | USED | Invoked in code |
| 7 | battles | USED | Invoked in code |
| 8 | calc_post_earnings | USED | Invoked in code |
| 9 | capture-content | USED | Invoked in code |
| 10 | charge-stored-card | USED | Invoked in code |
| 11 | create-paypal-order | USED | Invoked in code |
| 12 | create-square-checkout | USED | Invoked in code |
| 13 | customer-service-admin | USED | Invoked in code |
| 14 | delete-account | USED | Invoked in code |
| 15 | generate-ad | USED | Invoked in code |
| 16 | ghost-mode | USED | Invoked in code |
| 17 | global-ticker-notify | USED | Invoked in code |
| 18 | livekit-token | USED | Invoked in code |
| 19 | notify-stream-live | USED | Invoked in code |
| 20 | officer-actions | USED | Invoked in code |
| 21 | paypal-complete-order | USED | Invoked in code |
| 22 | paypal-create-order | USED | Invoked in code |
| 23 | paypal-payout | USED | Invoked in code |
| 24 | process-payout-batch | USED | Invoked in code |
| 25 | publish-social | USED | Invoked in code |
| 26 | push-notifications | USED | Invoked in code |
| 27 | redeem-maitalent-promo | USED | Invoked in code |
| 28 | send-message | USED | Invoked in code |
| 29 | sendEmail | USED | Invoked in code |
| 30 | social-oauth-init | USED | Invoked in code |
| 31 | stream-health-monitor | USED | Invoked in code |
| 32 | streams-maintenance | USED | Invoked in code |
| 33 | toggle-ghost-mode | USED | Invoked in code |
| 34 | verify-paypal-payment | USED | Invoked in code |
| 35 | verify-square-payment | USED | Invoked in code |

## Summary

- Total local functions: 35
- Used (invoked in code): 35
- Removed: 93 functions (90 marked R + manual-coin-order + 2 verified check-note functions: paypal-webhook, paypal-verify-transaction, payments-status, etc.)

### Removed functions by category

#### Confirmed unused (marked R)
admin-reset, adminScheduler, admin-stats, admin-stock-manager, agency-weekly-evaluation, ai-detect-ghost-inactivity, ai-verify-user, award-badge, bank-apply, close-officer-vote-cycle, complete-ghost-mission, create-square-customer, credit-daily-maintenance, credit-loan-handler, credit-record-event, credit-small-purchase-milestone, cron-tasks, debug-push, delete-user-account, dismiss-notification, end-home-feature-cycle, evaluate-badges-for-event, evaluate-missions, expire-officer-roles, gemini-verify-user, generate-pdf, get-training-scenario, go-live-refund-hd-boost, livekit-gaming, loan-payment, log-moderation-event, magicbell-jwt, mai-talent-timer-watcher, mai-talent-v2-orchestrator, moderation, officer-auto-clockout, officer-get-assignment, officer-touch-activity, ping, platform-fees, process-audio-queue, process-audio-safety, process-referral-bonuses, select-winner, send-announcement, send-bulk-notifications, send-like, shadow-ban-user, social-oauth-callback, square-save-card, square-webhook, start-officer-vote-cycle, start-podcast-recording, start-room-recording, stock-gamification, stock-price-engine, stop-podcast-recording, stop-room-recording, store-user-geolocation, submit-training-response, sync-mai-platform-user, track-guest, troll-battle, troll-events, troll-us-game, universal-battle, update-notification-preferences, user-agreements, verify-user-complete, vote-for-officer

#### Verified unused (0 frontend refs after check)
admin-reset, adminScheduler, admin-stats, admin-stock-manager, agency-weekly-evaluation, agora-media-gateway, ai-detect-ghost-inactivity, ai-verify-user, apply-punishment, auth, auto-clock-out, broadcast-seats, fulfill-paypal-purchase, go-live-mark-live, live, livekit-webhooks, officer-join-stream, officer-leave-stream, officer-report-abuse, payments-status, paypal-verify-transaction, paypal-webhook, send-bulk-notifications

#### Explicitly requested removal despite usage
generate-obs-credentials (used by refreshOnFocus.tsx), manual-coin-order (used by ManualPaymentModal.tsx), save-card (used by TrollCardSaver.tsx)

### Nesting
- `shared/log-bug-report`
