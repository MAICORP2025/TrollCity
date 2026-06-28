# Cashout System Unification — Summary

## Date: 2026-06-26

## Goal
Unify the cashout/payout system to use only the **Fast Pay / MAI Pay** flow (`payout_requests` + `fast_pay_applications`). Remove all legacy systems.

---

## New Rules

### Fee Structure
- **2.9% fee** deducted **upfront** when cashout request is made
- User must have enough escrow coins to cover **both** the payout amount AND the fee
- Fee is reserved from `cashout_coins` alongside the payout amount

### Level-Based Cashout Frequency
| Level | Frequency | Window |
|-------|-----------|--------|
| 1-499 | Every Friday | 1AM-7PM Mountain Time only |
| 500-999 | Every 24 hours | Any day |
| 1000+ | Every 30 minutes | Any day |
| Admins/CEO/Secretary | Always | Any time |

### Cooldown Periods
| Level | Cooldown |
|-------|----------|
| 1-499 | 7 days (Friday to Friday) |
| 500-999 | 24 hours |
| 1000+ | 30 minutes |

### Requirements
- Must have `cashout_approved = true` (via Fast Pay application admin approval)
- ID verification required first time or after 30 days
- No active loans
- Sufficient `cashout_coins - cashout_reserved_coins` balance

---

## Files Changed

### New Migration
- `supabase/migrations/20260626000000_unify_cashout_system_fast_pay_only.sql`
  - Updates `request_friday_cashout` RPC with fee + level-based timing
  - Updates `admin_process_payout` RPC to handle fee coins on reject
  - Drops all legacy functions (18 functions)
  - Drops all legacy tables (6 tables)
  - Adds helpful columns to `payout_requests`
  - Ensures `user_stats`, `cashout_tiers`, `fast_pay_applications` tables are properly set up

### Frontend Updates
| File | Change |
|------|--------|
| `src/pages/MaiPayPage.tsx` | Removed separate fee deduction; added level-based timing display; loads `cashout_approved` and `user_stats.level` |
| `src/pages/CashoutRequestPage.tsx` | Updated balance check to include fee; shows total required |
| `src/pages/Withdraw.tsx` | Rewritten to use `request_friday_cashout` RPC; shows fee breakdown |
| `src/pages/EarningsPayout.tsx` | Replaced with redirect to `/mai-pay` |
| `src/pages/admin/PayoutReview.tsx` | Uses `payout_requests` table; uses `admin_process_payout` RPC |
| `src/pages/admin/CashoutDetailPage.tsx` | Rewritten for `payout_requests` table |
| `src/pages/admin/AdminPayoutMobile.tsx` | Removed visa redemption section; uses unified system |
| `src/pages/admin/components/shared/CashoutRequestsList.tsx` | Uses `payout_requests` directly |
| `src/pages/admin/components/shared/GiftCardFulfillmentList.tsx` | Rewritten for `payout_requests` |
| `src/lib/payoutWindow.ts` | Deprecated; always returns true (backend handles gating) |
| `src/config/coinConfig.ts` | Fixed fee to 2.9%; added level-based timing helpers |
| `src/lib/hooks/useCoins.ts` | `depositToCashout` is now a no-op (auto-deposit) |
| `src/hooks/useAdminFinanceRealtime.ts` | Uses `payout_requests` |
| `src/pages/CEOAssistantDashboard.tsx` | Uses `admin_process_payout` instead of `forward_payout_to_admin` |
| `src/pages/SecretaryConsole.tsx` | Uses `payout_requests` |
| `src/pages/secretary/components/CashoutBonusPanel.tsx` | Uses `payout_requests` directly |
| `src/pages/secretary/components/SecretaryPayoutControl.tsx` | Removed `get_payout_window_status` call |
| `src/pages/admin/components/AutomatedPayouts.tsx` | Removed `get_payout_window_status` call |
| `src/pages/admin/components/TestDiagnostics.tsx` | Updated RPC test to `admin_process_payout` |
| `src/pages/GiftCardsPage.tsx` | Uses `payout_requests` |
| `src/components/OfficerAlertBanner.tsx` | Uses `payout_requests` |
| `src/components/PayoutHistoryCard.tsx` | Uses `payout_requests` |
| `src/App.tsx` | Removed routes to old pages (`/cashout-request`, `/withdraw`) |

### Edge Function Updates
| File | Change |
|------|--------|
| `supabase/functions/admin-actions/index.ts` | Uses `admin_process_payout` RPC |
| `supabase/functions/admin-actions/index_full.ts` | Uses `admin_process_payout` RPC |

---

## Tables Dropped (via migration)
- `visa_redemptions`
- `visa_redemptions_user_view`
- `cashout_requests`
- `cashout_gift_breakdown`
- `cashout_documents`
- `payout_window_status`
- `revenue_settings`

## Functions Dropped (via migration)
- `request_visa_redemption`
- `request_cashout_v3`
- `request_cashout_v2`
- `request_cashout`
- `admin_open_cashout_request`
- `admin_process_cashout_request`
- `get_cashout_request_details`
- `admin_verify_gift_eligibility`
- `approve_visa_redemption`
- `fulfill_visa_redemption`
- `reject_visa_redemption`
- `get_eligible_gift_coins`
- `is_cashout_window_open`
- `deposit_to_cashout_escrow`
- `reserve_all_cashout_coins`
- `admin_approve_payout`
- `forward_payout_to_admin`
- `get_payout_window_status`

## Tables Kept (active system)
- `payout_requests` — unified cashout request records
- `fast_pay_applications` — ID verification + payout method applications
- `cashout_tiers` — coin→USD tier mapping
- `user_profiles` — `cashout_coins`, `cashout_reserved_coins`, `cashout_approved`
- `user_stats` — `level` for timing rules
- `coin_transactions` — audit trail
- `loans` — active loan check
- `payment_holds` — payout blocks

## Functions Kept (active system)
- `request_friday_cashout` — unified cashout request (updated)
- `admin_process_payout` — approve/pay/reject (updated)
- `submit_fast_pay_application` — Fast Pay application
- `review_fast_pay_application` — admin review of Fast Pay app

---

## Deployment Steps

1. **Run the migration** on Supabase:
   ```bash
   supabase db push
   ```
   or apply `supabase/migrations/20260626000000_unify_cashout_system_fast_pay_only.sql`

2. **Deploy the frontend** changes

3. **Verify**:
   - Users can submit cashouts via `/mai-pay`
   - Admins can review via `/admin/cashout-manager`
   - Fee is deducted upfront
   - Level-based timing is enforced
   - Old routes (`/cashout-request`, `/withdraw`) return 404

---

## Testing Checklist

- [ ] User with level 1-499 can only cashout on Friday 1AM-7PM MT
- [ ] User with level 500-999 can cashout every 24 hours
- [ ] User with level 1000+ can cashout every 60 minutes
- [ ] Fee (2.9%) is deducted upfront from escrow balance
- [ ] User must have `cashout_approved = true` to cashout
- [ ] ID verification required first time or after 30 days
- [ ] Admin can approve/pay/reject via `admin_process_payout`
- [ ] Rejected payouts return coins (including fee) to escrow
- [ ] Paid payouts release reserved coins
- [ ] No references to old system remain in frontend
