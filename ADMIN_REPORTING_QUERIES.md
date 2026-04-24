# Admin Reporting Queries

Use these SQL queries in the Supabase SQL Editor or your admin dashboard to track the platform's financial health.

## 1. Total Platform Liability (Coins & USD)
Returns the total coins earned by users that are eligible for cashout, and their estimated USD value.

```sql
SELECT 
  SUM(earned_balance) as total_liability_coins,
  -- Estimate USD liability (simplified linear approx or complex calculation)
  -- Since tiers are non-linear, exact liability depends on who cashes out.
  -- This gives a "worst case" if everyone cashed out at max tier (~$0.0027/coin).
  SUM(earned_balance) * 0.0027 as estimated_liability_usd
FROM public.user_profiles
WHERE earned_balance > 0;
```

## 2. Admin Pool Status
Returns the system wallet balance and tracked totals.

```sql
SELECT 
  trollcoins_balance as system_fee_accumulated,
  total_liability_coins as tracked_unpaid_liability,
  total_paid_usd as total_cash_paid_out
FROM public.admin_pool;
```

## 3. Per-User Owed Amount
Shows how much each user *could* cash out right now, and the USD value if they did.

```sql
SELECT 
  username,
  earned_balance as cashable_coins,
  troll_coins as total_balance,
  public.calculate_cashout_value(LEAST(earned_balance, troll_coins)) as potential_cashout_value
FROM public.user_profiles
WHERE earned_balance > 0
ORDER BY earned_balance DESC;
```

## 4. Pending Cashouts
List of all requests waiting for approval.

```sql
SELECT 
  pr.id,
  up.username,
  pr.cash_amount as usd_requested,
  pr.coins_amount as coins_locked,
  pr.created_at
FROM public.payout_requests pr
JOIN public.user_profiles up ON pr.user_id = up.id
WHERE pr.status = 'pending'
ORDER BY pr.created_at ASC;
```

## 5. Audit Log (Recent Activity)
Shows the last 50 events affecting the admin pool.

```sql
SELECT 
  apl.created_at,
  apl.reason,
  apl.amount,
  apl.usd_value,
  up.username as related_user
FROM public.admin_pool_ledger apl
LEFT JOIN public.user_profiles up ON apl.ref_user_id = up.id
ORDER BY apl.created_at DESC
LIMIT 50;
```
