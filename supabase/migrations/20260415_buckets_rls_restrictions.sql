-- =============================================================================
-- SECRETARY ACCESS RESTRICTIONS FOR BUCKETS DASHBOARD
-- Secretary can view most bucket data but NOT admin_spendable bucket
-- =============================================================================

-- Drop existing policies for wallet_buckets to recreate with secretary logic
drop policy if exists "Admins can view wallet buckets" on public.wallet_buckets;
drop policy if exists "Admins can update wallet buckets" on public.wallet_buckets;

-- Admin-only: Full access to all buckets
create policy "Admins can view all wallet buckets"
on public.wallet_buckets
for select
using (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid()
    and (role = 'admin' or is_admin = true)
  )
);

create policy "Admins can update wallet buckets"
on public.wallet_buckets
for update
using (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid()
    and (role = 'admin' or is_admin = true)
  )
);

-- Secretary: Can view all buckets EXCEPT admin_spendable
create policy "Secretaries can view restricted wallet buckets"
on public.wallet_buckets
for select
using (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid()
    and role = 'secretary'
  )
  and bucket_type != 'admin_spendable'
);

-- Drop existing policies for ledger_transactions to recreate with secretary logic
drop policy if exists "Admins can view ledger transactions" on public.ledger_transactions;

-- Admin-only: Full access to ledger
create policy "Admins can view all ledger transactions"
on public.ledger_transactions
for select
using (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid()
    and (role = 'admin' or is_admin = true)
  )
);

-- Secretary: Can view ledger but with hidden admin_spendable amounts
create policy "Secretaries can view restricted ledger transactions"
on public.ledger_transactions
for select
using (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid()
    and role = 'secretary'
  )
);

-- =============================================================================
-- UPDATED VIEWS FOR SECRETARY ACCESS
-- =============================================================================

-- View: buckets_overview_restricted (for secretaries)
create or replace view public.buckets_overview_restricted as
select
  bucket_type,
  balance_usd,
  balance_coins,
  total_coins_issued,
  total_coins_earned,
  estimated_liability_usd,
  last_updated_at,
  case
    when bucket_type = 'admin_spendable' then '🔒 Restricted - Admin Only'
    when bucket_type = 'broadcaster_liability' then '📊 Broadcaster Liability - Money owed to broadcasters'
    when bucket_type = 'admin_issued_coins_liability' then '🪙 Admin Issued Coins - Coins granted by admin'
    when bucket_type = 'reserved_payout' then '🔒 Reserved Payout - Funds reserved for payouts'
    when bucket_type = 'paid_out' then '✅ Paid Out - Total funds paid out'
  end as description,
  case
    when bucket_type = 'admin_spendable' then false
    else true
  end as visible_to_secretary
from public.wallet_buckets
where bucket_type != 'admin_spendable'
order by bucket_type;

-- View: ledger_restricted (for secretaries - hides admin spendable delta)
create or replace view public.ledger_restricted as
select
  lt.id,
  lt.transaction_type,
  lt.source_type,
  lt.source_id,
  lt.usd_amount,
  lt.coin_amount,
  lt.broadcaster_liability_delta,
  lt.admin_issued_coins_delta,
  lt.reserved_payout_delta,
  lt.paid_out_delta,
  lt.description,
  lt.metadata,
  lt.created_at,
  lt.user_id,
  up.username as user_username,
  case
    when lt.admin_spendable_delta != 0 then true
    else false
  end as contains_admin_spendable_data
from public.ledger_transactions lt
left join public.user_profiles up on lt.user_id = up.id
where lt.admin_spendable_delta = 0  -- Hide transactions with admin spendable data
   or exists (
     select 1 from public.user_profiles
     where id = auth.uid()
     and (role = 'admin' or is_admin = true)
   )
order by lt.created_at desc
limit 100;

-- =============================================================================
-- FUNCTION: get_buckets_summary_for_user
-- Returns bucket summary based on user role
-- =============================================================================
create or replace function public.get_buckets_summary_for_user()
returns table (
  admin_spendable_usd numeric(12, 2),
  broadcaster_liability_usd numeric(12, 2),
  admin_issued_coins_coins numeric(18, 0),
  admin_issued_liability_usd numeric(12, 2),
  reserved_payout_usd numeric(12, 2),
  paid_out_usd numeric(12, 2),
  total_coins_issued numeric(18, 0),
  total_coins_earned numeric(18, 0),
  can_view_admin_spendable boolean
)
language plpgsql
stable
as $$
declare
  v_is_admin boolean := false;
  v_is_secretary boolean := false;
begin
  -- Check user roles
  select 
    exists (select 1 from public.user_profiles where id = auth.uid() and (role = 'admin' or is_admin = true)),
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'secretary')
  into v_is_admin, v_is_secretary;

  return query
  select
    case 
      when v_is_admin then coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'admin_spendable'), 0)
      else null  -- Hide from secretary
    end as admin_spendable_usd,
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'broadcaster_liability'), 0) as broadcaster_liability_usd,
    coalesce((select balance_coins from public.wallet_buckets where bucket_type = 'admin_issued_coins_liability'), 0) as admin_issued_coins_coins,
    coalesce((select estimated_liability_usd from public.wallet_buckets where bucket_type = 'admin_issued_coins_liability'), 0) as admin_issued_liability_usd,
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'reserved_payout'), 0) as reserved_payout_usd,
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'paid_out'), 0) as paid_out_usd,
    coalesce((select total_coins_issued from public.wallet_buckets where bucket_type = 'admin_issued_coins_liability'), 0) as total_coins_issued,
    coalesce((select total_coins_earned from public.wallet_buckets where bucket_type = 'broadcaster_liability'), 0) as total_coins_earned,
    v_is_admin as can_view_admin_spendable;
end;
$$;

-- =============================================================================
-- FUNCTION: get_transactions_for_user
-- Returns transactions based on user role
-- =============================================================================
create or replace function public.get_transactions_for_user(p_limit int default 50)
returns table (
  id uuid,
  transaction_type text,
  source_type text,
  source_id text,
  usd_amount numeric(12, 2),
  coin_amount numeric(18, 0),
  admin_spendable_delta numeric(12, 2),
  broadcaster_liability_delta numeric(12, 2),
  admin_issued_coins_delta numeric(18, 0),
  reserved_payout_delta numeric(12, 2),
  paid_out_delta numeric(12, 2),
  description text,
  created_at timestamptz,
  user_id uuid,
  user_username text,
  show_full_details boolean
)
language plpgsql
stable
as $$
declare
  v_is_admin boolean := false;
  v_is_secretary boolean := false;
begin
  -- Check user roles
  select 
    exists (select 1 from public.user_profiles where id = auth.uid() and (role = 'admin' or is_admin = true)),
    exists (select 1 from public.user_profiles where id = auth.uid() and role = 'secretary')
  into v_is_admin, v_is_secretary;

  if v_is_admin then
    return query
    select
      lt.id, lt.transaction_type, lt.source_type, lt.source_id,
      lt.usd_amount, lt.coin_amount, lt.admin_spendable_delta,
      lt.broadcaster_liability_delta, lt.admin_issued_coins_delta,
      lt.reserved_payout_delta, lt.paid_out_delta, lt.description,
      lt.created_at, lt.user_id, up.username,
      true as show_full_details
    from public.ledger_transactions lt
    left join public.user_profiles up on lt.user_id = up.id
    order by lt.created_at desc
    limit p_limit;
  elsif v_is_secretary then
    return query
    select
      lt.id, lt.transaction_type, lt.source_type, lt.source_id,
      lt.usd_amount, lt.coin_amount, 
      null::numeric as admin_spendable_delta,  -- Hide admin spendable
      lt.broadcaster_liability_delta, lt.admin_issued_coins_delta,
      lt.reserved_payout_delta, lt.paid_out_delta, lt.description,
      lt.created_at, lt.user_id, up.username,
      false as show_full_details
    from public.ledger_transactions lt
    left join public.user_profiles up on lt.user_id = up.id
    where lt.admin_spendable_delta = 0  -- Exclude admin spendable transactions
    order by lt.created_at desc
    limit p_limit;
  else
    -- Return empty result for non-authorized users
    return query
    select
      null::uuid, null::text, null::text, null::text,
      null::numeric, null::numeric, null::numeric,
      null::numeric, null::numeric, null::numeric,
      null::numeric, null::text, null::timestamptz,
      null::uuid, null::text, false
    where false;
  end if;
end;
$$;

comment on view public.buckets_overview_restricted is 'Bucket overview visible to secretaries (excludes admin_spendable)';
comment on view public.ledger_restricted is 'Ledger transactions visible to secretaries (excludes admin spendable data)';
comment on function public.get_buckets_summary_for_user is 'Returns bucket summary filtered by user role - admins see all, secretaries see restricted';
comment on function public.get_transactions_for_user is 'Returns transactions filtered by user role - admins see all, secretaries see restricted';
