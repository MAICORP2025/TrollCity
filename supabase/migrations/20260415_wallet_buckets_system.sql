-- =============================================================================
-- WALLET BUCKETS AND LEDGER TRANSACTIONS SYSTEM
-- Implements financial bucket tracking for admin spendable funds and broadcaster liabilities
-- Also includes payout safeguard system
-- =============================================================================

-- =============================================================================
-- TABLE: wallet_buckets
-- Stores the main bucket balances for the platform
-- =============================================================================
create table if not exists public.wallet_buckets (
  id uuid primary key default gen_random_uuid(),
  bucket_type text not null check (bucket_type in (
    'admin_spendable',
    'broadcaster_liability',
    'admin_issued_coins_liability',
    'reserved_payout',
    'paid_out'
  )),
  balance_usd numeric(12, 2) not null default 0.00,
  balance_coins numeric(18, 0) not null default 0,
  total_coins_issued numeric(18, 0) not null default 0,
  total_coins_earned numeric(18, 0) not null default 0,
  estimated_liability_usd numeric(12, 2) not null default 0.00,
  last_updated_at timestamptz default now(),
  created_at timestamptz default now(),
  constraint wallet_buckets_unique_type unique (bucket_type)
);

-- Enable RLS
alter table public.wallet_buckets enable row level security;

-- Create indexes
create index if not exists idx_wallet_buckets_type on public.wallet_buckets(bucket_type);

-- =============================================================================
-- TABLE: ledger_transactions
-- Logs every allocation event (money split + coin grants)
-- =============================================================================
create table if not exists public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_type text not null check (transaction_type in (
    'paypal_purchase',
    'coin_grant_admin',
    'coin_grant_broadcast',
    'payout_reserved',
    'payout_completed',
    'payout_released',
    'bucket_adjustment',
    'manual_entry'
  )),
  source_type text not null check (source_type in (
    'paypal_capture',
    'admin_action',
    'broadcast_earning',
    'payout_request',
    'manual_adjustment',
    'refund'
  )),
  source_id text,  -- External reference (PayPal order_id, capture_id, user_id, etc.)
  
  -- Amount fields
  usd_amount numeric(12, 2) not null default 0.00,
  coin_amount numeric(18, 0) not null default 0,
  
  -- Bucket allocations (for $ split tracking)
  admin_spendable_delta numeric(12, 2) default 0.00,
  broadcaster_liability_delta numeric(12, 2) default 0.00,
  admin_issued_coins_delta numeric(18, 0) default 0,
  reserved_payout_delta numeric(12, 2) default 0.00,
  paid_out_delta numeric(12, 2) default 0.00,
  
  -- User context (if applicable)
  user_id uuid references public.user_profiles(id) on delete set null,
  
  -- Description and metadata
  description text,
  metadata jsonb default '{}',
  
  -- Idempotency check
  unique_reference text unique,  -- PayPal capture_id, etc.
  
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.ledger_transactions enable row level security;

-- Create indexes
create index if not exists idx_ledger_transactions_type on public.ledger_transactions(transaction_type);
create index if not exists idx_ledger_transactions_source on public.ledger_transactions(source_type, source_id);
create index if not exists idx_ledger_transactions_user on public.ledger_transactions(user_id);
create index if not exists idx_ledger_transactions_created on public.ledger_transactions(created_at desc);
create index if not exists idx_ledger_transactions_unique_ref on public.ledger_transactions(unique_reference);

-- =============================================================================
-- TABLE: payout_requests (Enhanced with safeguard fields)
-- =============================================================================
create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  
  -- Payout details
  coin_amount numeric(18, 0) not null,
  cash_amount numeric(12, 2) not null,
  processing_fee numeric(12, 2) default 0.00,
  net_amount numeric(12, 2) not null,
  
  -- Payout method
  payout_method text not null default 'paypal' check (payout_method in ('paypal', 'square', 'other')),
  payout_details text,  -- PayPal email, etc.
  
  -- Status tracking
  status text not null default 'pending' check (status in (
    'pending',
    'pending_funds',      -- Blocked due to insufficient funds
    'approved',
    'processing',
    'completed',
    'rejected',
    'cancelled'
  )),
  
  -- Funds validation
  funds_check_passed boolean default false,
  broadcaster_liability_at_request numeric(12, 2),
  reserved_payout_at_request numeric(12, 2),
  
  -- Processing tracking
  approved_by uuid references public.user_profiles(id),
  approved_at timestamptz,
  processed_at timestamptz,
  completed_at timestamptz,
  
  -- PayPal/Square tracking
  paypal_payout_id text,
  square_payout_id text,
  
  -- Rejection reason
  rejection_reason text,
  
  -- Timestamps
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint payout_requests_unique_pending unique (user_id, status)
);

-- Enable RLS
alter table public.payout_requests enable row level security;

-- Create indexes
create index if not exists idx_payout_requests_user on public.payout_requests(user_id);
create index if not exists idx_payout_requests_status on public.payout_requests(status);
create index if not exists idx_payout_requests_created on public.payout_requests(created_at desc);

-- =============================================================================
-- FUNCTION: initialize_wallet_buckets
-- Creates initial bucket records if they don't exist
-- =============================================================================
create or replace function public.initialize_wallet_buckets()
returns void
language plpgsql
as $$
begin
  -- Insert admin spendable bucket
  insert into public.wallet_buckets (bucket_type, balance_usd, balance_coins)
  values ('admin_spendable', 0.00, 0)
  on conflict (bucket_type) do nothing;
  
  -- Insert broadcaster liability bucket
  insert into public.wallet_buckets (bucket_type, balance_usd, balance_coins)
  values ('broadcaster_liability', 0.00, 0)
  on conflict (bucket_type) do nothing;
  
  -- Insert admin issued coins liability bucket
  insert into public.wallet_buckets (bucket_type, balance_usd, balance_coins)
  values ('admin_issued_coins_liability', 0.00, 0)
  on conflict (bucket_type) do nothing;
  
  -- Insert reserved payout bucket
  insert into public.wallet_buckets (bucket_type, balance_usd, balance_coins)
  values ('reserved_payout', 0.00, 0)
  on conflict (bucket_type) do nothing;
  
  -- Insert paid out bucket
  insert into public.wallet_buckets (bucket_type, balance_usd, balance_coins)
  values ('paid_out', 0.00, 0)
  on conflict (bucket_type) do nothing;
end;
$$;

-- =============================================================================
-- FUNCTION: get_bucket_balance
-- Gets the current balance of a specific bucket
-- =============================================================================
create or replace function public.get_bucket_balance(p_bucket_type text)
returns table (
  bucket_type text,
  balance_usd numeric(12, 2),
  balance_coins numeric(18, 0),
  total_coins_issued numeric(18, 0),
  total_coins_earned numeric(18, 0),
  estimated_liability_usd numeric(12, 2),
  last_updated_at timestamptz
)
language plpgsql
stable
as $$
begin
  return query
  select 
    wb.bucket_type,
    wb.balance_usd,
    wb.balance_coins,
    wb.total_coins_issued,
    wb.total_coins_earned,
    wb.estimated_liability_usd,
    wb.last_updated_at
  from public.wallet_buckets wb
  where wb.bucket_type = p_bucket_type;
end;
$$;

-- =============================================================================
-- FUNCTION: update_bucket_balance
-- Updates a bucket balance with atomic increment
-- =============================================================================
create or replace function public.update_bucket_balance(
  p_bucket_type text,
  p_usd_delta numeric(12, 2),
  p_coins_delta numeric(18, 0) default 0,
  p_total_issued_delta numeric(18, 0) default 0,
  p_total_earned_delta numeric(18, 0) default 0,
  p_liability_delta numeric(12, 2) default 0
)
returns void
language plpgsql
as $$
begin
  update public.wallet_buckets
  set 
    balance_usd = balance_usd + p_usd_delta,
    balance_coins = balance_coins + p_coins_delta,
    total_coins_issued = total_coins_issued + p_total_issued_delta,
    total_coins_earned = total_coins_earned + p_total_earned_delta,
    estimated_liability_usd = estimated_liability_usd + p_liability_delta,
    last_updated_at = now()
  where bucket_type = p_bucket_type;
end;
$$;

-- =============================================================================
-- FUNCTION: record_ledger_transaction
-- Records a ledger transaction and updates bucket balances atomically
-- =============================================================================
create or replace function public.record_ledger_transaction(
  p_transaction_type text,
  p_source_type text,
  p_source_id text,
  p_usd_amount numeric(12, 2),
  p_coin_amount numeric(18, 0) default 0,
  p_admin_spendable_delta numeric(12, 2) default 0,
  p_broadcaster_liability_delta numeric(12, 2) default 0,
  p_admin_issued_coins_delta numeric(18, 0) default 0,
  p_reserved_payout_delta numeric(12, 2) default 0,
  p_paid_out_delta numeric(12, 2) default 0,
  p_user_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_unique_reference text default null
)
returns uuid
language plpgsql
as $$
declare
  v_transaction_id uuid;
  v_existing_ref text;
begin
  -- Check for duplicate transaction using unique_reference
  if p_unique_reference is not null then
    select unique_reference into v_existing_ref
    from public.ledger_transactions
    where unique_reference = p_unique_reference
    limit 1;
    
    if v_existing_ref is not null then
      -- Return existing transaction ID
      select id into v_transaction_id
      from public.ledger_transactions
      where unique_reference = p_unique_reference
      limit 1;
      return v_transaction_id;
    end if;
  end if;
  
  -- Insert the ledger transaction
  insert into public.ledger_transactions (
    transaction_type,
    source_type,
    source_id,
    usd_amount,
    coin_amount,
    admin_spendable_delta,
    broadcaster_liability_delta,
    admin_issued_coins_delta,
    reserved_payout_delta,
    paid_out_delta,
    user_id,
    description,
    metadata,
    unique_reference
  ) values (
    p_transaction_type,
    p_source_type,
    p_source_id,
    p_usd_amount,
    p_coin_amount,
    p_admin_spendable_delta,
    p_broadcaster_liability_delta,
    p_admin_issued_coins_delta,
    p_reserved_payout_delta,
    p_paid_out_delta,
    p_user_id,
    p_description,
    p_metadata,
    p_unique_reference
  )
  returning id into v_transaction_id;
  
  -- Update bucket balances atomically
  if p_admin_spendable_delta != 0 then
    perform public.update_bucket_balance('admin_spendable', p_admin_spendable_delta);
  end if;
  
  if p_broadcaster_liability_delta != 0 then
    perform public.update_bucket_balance('broadcaster_liability', p_broadcaster_liability_delta);
  end if;
  
  if p_admin_issued_coins_delta != 0 then
    perform public.update_bucket_balance('admin_issued_coins_liability', 0, p_admin_issued_coins_delta);
  end if;
  
  if p_reserved_payout_delta != 0 then
    perform public.update_bucket_balance('reserved_payout', p_reserved_payout_delta);
  end if;
  
  if p_paid_out_delta != 0 then
    perform public.update_bucket_balance('paid_out', p_paid_out_delta);
  end if;
  
  return v_transaction_id;
end;
$$;

-- =============================================================================
-- FUNCTION: process_paypal_capture_allocation
-- Allocates PayPal capture: $1 to admin_spendable, remainder to broadcaster_liability
-- =============================================================================
create or replace function public.process_paypal_capture_allocation(
  p_usd_amount numeric(12, 2),
  p_coin_amount numeric(18, 0),
  p_capture_id text,
  p_paypal_order_id text,
  p_user_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_admin_amount numeric(12, 2) := 1.00;
  v_broadcaster_amount numeric(12, 2);
  v_transaction_id uuid;
begin
  -- Calculate broadcaster liability (total minus admin portion)
  v_broadcaster_amount := p_usd_amount - v_admin_amount;
  
  -- Ensure non-negative broadcaster liability
  if v_broadcaster_amount < 0 then
    v_broadcaster_amount := 0;
    v_admin_amount := p_usd_amount;
  end if;
  
  -- Record the transaction with atomic bucket updates
  select public.record_ledger_transaction(
    'paypal_purchase',
    'paypal_capture',
    p_paypal_order_id,
    p_usd_amount,
    p_coin_amount,
    v_admin_amount,                    -- Admin spendable
    v_broadcaster_amount,              -- Broadcaster liability
    0,                                 -- No coins issued in this step
    0,
    0,
    p_user_id,
    format('PayPal purchase: $%s → $1 admin + $%s broadcaster_liability', p_usd_amount, v_broadcaster_amount),
    p_metadata,
    p_capture_id                       -- Unique reference for idempotency
  ) into v_transaction_id;
  
  return v_transaction_id;
end;
$$;

-- =============================================================================
-- FUNCTION: grant_admin_coins
-- Grants coins and tracks in admin_issued_coins_liability
-- =============================================================================
create or replace function public.grant_admin_coins(
  p_user_id uuid,
  p_coin_amount numeric(18, 0),
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_transaction_id uuid;
  v_estimated_liability numeric(12, 2);
begin
  -- Calculate estimated liability (100 coins = $1)
  v_estimated_liability := p_coin_amount / 100.00;
  
  -- Record the transaction
  select public.record_ledger_transaction(
    'coin_grant_admin',
    'admin_action',
    p_user_id::text,
    0,
    p_coin_amount,
    0,
    0,
    p_coin_amount,
    0,
    0,
    p_user_id,
    p_description,
    p_metadata,
    format('admin_grant_%s_%s', p_user_id, now()::text)
  ) into v_transaction_id;
  
  -- Update the liability bucket's estimated USD value
  perform public.update_bucket_balance(
    'admin_issued_coins_liability',
    v_estimated_liability,  -- Add to liability USD
    0,
    p_coin_amount,          -- Add to total issued
    0,
    v_estimated_liability  -- Add to estimated liability
  );
  
  return v_transaction_id;
end;
$$;

-- =============================================================================
-- FUNCTION: record_broadcast_earning
-- Records coins earned from broadcasts
-- =============================================================================
create or replace function public.record_broadcast_earning(
  p_user_id uuid,
  p_coin_amount numeric(18, 0),
  p_usd_earned numeric(12, 2),
  p_stream_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_transaction_id uuid;
begin
  -- Record the transaction
  select public.record_ledger_transaction(
    'coin_grant_broadcast',
    'broadcast_earning',
    p_stream_id,
    p_usd_earned,
    p_coin_amount,
    0,
    p_usd_earned,  -- Add to broadcaster liability (money owed to broadcaster)
    0,
    0,
    0,
    p_user_id,
    format('Broadcast earning: %s coins (~$%s)', p_coin_amount, p_usd_earned),
    p_metadata,
    format('broadcast_%s_%s', p_stream_id, now()::text)
  ) into v_transaction_id;
  
  return v_transaction_id;
end;
$$;

-- =============================================================================
-- FUNCTION: validate_payout_eligibility
-- Validates if a payout request can be processed based on bucket funds
-- =============================================================================
create or replace function public.validate_payout_eligibility(
  p_user_id uuid,
  p_cash_amount numeric(12, 2)
)
returns table (
  is_eligible boolean,
  error_message text,
  broadcaster_liability_balance numeric(12, 2),
  reserved_payout_balance numeric(12, 2),
  available_for_payout numeric(12, 2)
)
language plpgsql
stable
as $$
declare
  v_broadcaster_liability numeric(12, 2) := 0;
  v_reserved_payout numeric(12, 2) := 0;
  v_available numeric(12, 2) := 0;
begin
  -- Get current bucket balances
  select 
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'broadcaster_liability'), 0),
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'reserved_payout'), 0)
  into v_broadcaster_liability, v_reserved_payout;
  
  -- Calculate available for payout (liability minus already reserved)
  v_available := v_broadcaster_liability - v_reserved_payout;
  
  -- Check eligibility
  if v_available < p_cash_amount then
    return query
    select 
      false,
      format('Insufficient funds. Required: $%s, Available: $%s. Payout will be marked as pending_funds until funds are available.', p_cash_amount, v_available),
      v_broadcaster_liability,
      v_reserved_payout,
      v_available;
  end if;
  
  return query
  select 
    true,
    null,
    v_broadcaster_liability,
    v_reserved_payout,
    v_available;
end;
$$;

-- =============================================================================
-- FUNCTION: reserve_payout_funds
-- Reserves funds for a payout by moving from broadcaster_liability to reserved_payout
-- =============================================================================
create or replace function public.reserve_payout_funds(
  p_payout_request_id uuid,
  p_cash_amount numeric(12, 2)
)
returns boolean
language plpgsql
as $$
declare
  v_broadcaster_liability numeric(12, 2) := 0;
  v_reserved_payout numeric(12, 2) := 0;
  v_available numeric(12, 2) := 0;
begin
  -- Get current bucket balances
  select 
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'broadcaster_liability'), 0),
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'reserved_payout'), 0)
  into v_broadcaster_liability, v_reserved_payout;
  
  v_available := v_broadcaster_liability - v_reserved_payout;
  
  -- Check if enough funds available
  if v_available < p_cash_amount then
    -- Update payout request to pending_funds status
    update public.payout_requests
    set 
      status = 'pending_funds',
      broadcaster_liability_at_request = v_broadcaster_liability,
      reserved_payout_at_request = v_reserved_payout,
      updated_at = now()
    where id = p_payout_request_id;
    
    return false;
  end if;
  
  -- Reserve the funds: broadcaster_liability -> reserved_payout
  perform public.record_ledger_transaction(
    'payout_reserved',
    'payout_request',
    p_payout_request_id::text,
    p_cash_amount,
    0,
    0,                    -- No admin spendable change
    -p_cash_amount,       -- Decrease broadcaster liability
    0,
    p_cash_amount,        -- Increase reserved payout
    0,
    null,
    format('Funds reserved for payout request: %s', p_payout_request_id),
    '{}'::jsonb,
    format('payout_reserve_%s', p_payout_request_id)
  );
  
  -- Update payout request status
  update public.payout_requests
  set 
    status = 'approved',
    funds_check_passed = true,
    broadcaster_liability_at_request = v_broadcaster_liability,
    reserved_payout_at_request = v_reserved_payout,
    updated_at = now()
  where id = p_payout_request_id;
  
  return true;
end;
$$;

-- =============================================================================
-- FUNCTION: complete_payout
-- Marks payout as completed, moving funds from reserved_payout to paid_out
-- =============================================================================
create or replace function public.complete_payout(
  p_payout_request_id uuid,
  p_payout_id text
)
returns boolean
language plpgsql
as $$
declare
  v_payout record;
  v_success boolean := false;
begin
  -- Get payout request
  select * into v_payout
  from public.payout_requests
  where id = p_payout_request_id;
  
  if not found then
    return false;
  end if;
  
  -- Move funds: reserved_payout -> paid_out
  perform public.record_ledger_transaction(
    'payout_completed',
    'payout_request',
    p_payout_request_id::text,
    v_payout.net_amount,
    0,
    0,
    0,
    0,
    -v_payout.net_amount,  -- Decrease reserved payout
    v_payout.net_amount,   -- Increase paid out
    null,
    format('Payout completed: %s -> %s', p_payout_request_id, p_payout_id),
    '{}'::jsonb,
    format('payout_complete_%s', p_payout_request_id)
  );
  
  -- Update payout request status
  update public.payout_requests
  set 
    status = 'completed',
    paypal_payout_id = p_payout_id,
    processed_at = now(),
    completed_at = now(),
    updated_at = now()
  where id = p_payout_request_id;
  
  return true;
end;
$$;

-- =============================================================================
-- FUNCTION: release_payout_reservation
-- Releases reserved funds back to broadcaster_liability (if payout cancelled)
-- =============================================================================
create or replace function public.release_payout_reservation(
  p_payout_request_id uuid
)
returns boolean
language plpgsql
as $$
declare
  v_payout record;
begin
  -- Get payout request
  select * into v_payout
  from public.payout_requests
  where id = p_payout_request_id;
  
  if not found then
    return false;
  end if;
  
  if v_payout.status != 'approved' then
    return false;
  end if;
  
  -- Release funds: reserved_payout -> broadcaster_liability
  perform public.record_ledger_transaction(
    'payout_released',
    'payout_request',
    p_payout_request_id::text,
    v_payout.net_amount,
    0,
    0,
    v_payout.net_amount,   -- Return to broadcaster liability
    0,
    -v_payout.net_amount,  -- Decrease reserved payout
    0,
    null,
    format('Payout reservation released: %s', p_payout_request_id),
    '{}'::jsonb,
    format('payout_release_%s', p_payout_request_id)
  );
  
  -- Update payout request status
  update public.payout_requests
  set 
    status = 'cancelled',
    updated_at = now()
  where id = p_payout_request_id;
  
  return true;
end;
$$;

-- =============================================================================
-- FUNCTION: get_buckets_summary
-- Returns summary of all bucket balances
-- =============================================================================
create or replace function public.get_buckets_summary()
returns table (
  admin_spendable_usd numeric(12, 2),
  broadcaster_liability_usd numeric(12, 2),
  admin_issued_coins_coins numeric(18, 0),
  admin_issued_liability_usd numeric(12, 2),
  reserved_payout_usd numeric(12, 2),
  paid_out_usd numeric(12, 2),
  total_coins_issued numeric(18, 0),
  total_coins_earned numeric(18, 0)
)
language plpgsql
stable
as $$
begin
  return query
  select
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'admin_spendable'), 0),
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'broadcaster_liability'), 0),
    coalesce((select balance_coins from public.wallet_buckets where bucket_type = 'admin_issued_coins_liability'), 0),
    coalesce((select estimated_liability_usd from public.wallet_buckets where bucket_type = 'admin_issued_coins_liability'), 0),
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'reserved_payout'), 0),
    coalesce((select balance_usd from public.wallet_buckets where bucket_type = 'paid_out'), 0),
    coalesce((select total_coins_issued from public.wallet_buckets where bucket_type = 'admin_issued_coins_liability'), 0),
    coalesce((select total_coins_earned from public.wallet_buckets where bucket_type = 'broadcaster_liability'), 0);
end;
$$;

-- =============================================================================
-- FUNCTION: get_recent_ledger_transactions
-- Returns recent ledger transactions (last 30 by default)
-- =============================================================================
create or replace function public.get_recent_ledger_transactions(p_limit int default 30)
returns table (
  id uuid,
  transaction_type text,
  source_type text,
  source_id text,
  usd_amount numeric(12, 2),
  coin_amount numeric(18, 0),
  description text,
  created_at timestamptz
)
language plpgsql
stable
as $$
begin
  return query
  select
    lt.id,
    lt.transaction_type,
    lt.source_type,
    lt.source_id,
    lt.usd_amount,
    lt.coin_amount,
    lt.description,
    lt.created_at
  from public.ledger_transactions lt
  order by lt.created_at desc
  limit p_limit;
end;
$$;

-- =============================================================================
-- FUNCTION: get_pending_payouts_summary
-- Returns summary of pending payouts
-- =============================================================================
create or replace function public.get_pending_payouts_summary()
returns table (
  pending_count int,
  pending_amount numeric(12, 2),
  pending_funds_count int,
  pending_funds_amount numeric(12, 2),
  approved_count int,
  approved_amount numeric(12, 2)
)
language plpgsql
stable
as $$
begin
  return query
  select
    count(case when status = 'pending' then 1 end)::int as pending_count,
    coalesce(sum(case when status = 'pending' then net_amount else 0 end), 0)::numeric(12,2) as pending_amount,
    count(case when status = 'pending_funds' then 1 end)::int as pending_funds_count,
    coalesce(sum(case when status = 'pending_funds' then net_amount else 0 end), 0)::numeric(12,2) as pending_funds_amount,
    count(case when status = 'approved' then 1 end)::int as approved_count,
    coalesce(sum(case when status = 'approved' then net_amount else 0 end), 0)::numeric(12,2) as approved_amount
  from public.payout_requests
  where status in ('pending', 'pending_funds', 'approved');
end;
$$;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- Admin-only access to wallet_buckets
create policy "Admins can view wallet buckets"
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

-- Admin-only access to ledger_transactions
create policy "Admins can view ledger transactions"
on public.ledger_transactions
for select
using (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid()
    and (role = 'admin' or is_admin = true)
  )
);

create policy "System can insert ledger transactions"
on public.ledger_transactions
for insert
with check (true);  -- Handled by functions

-- Payout request policies
create policy "Users can view their own payout requests"
on public.payout_requests
for select
using (auth.uid() = user_id);

create policy "Users can create payout requests"
on public.payout_requests
for insert
with check (auth.uid() = user_id);

create policy "Admins can view all payout requests"
on public.payout_requests
for select
using (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid()
    and (role = 'admin' or is_admin = true)
  )
);

create policy "Admins can update payout requests"
on public.payout_requests
for update
using (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid()
    and (role = 'admin' or is_admin = true)
  )
);

-- =============================================================================
-- INITIALIZATION
-- Initialize wallet buckets on first run
-- =============================================================================
select public.initialize_wallet_buckets();

-- =============================================================================
-- VIEWS FOR ADMIN DASHBOARD
-- =============================================================================

-- View: buckets_overview
create or replace view public.buckets_overview as
select
  bucket_type,
  balance_usd,
  balance_coins,
  total_coins_issued,
  total_coins_earned,
  estimated_liability_usd,
  last_updated_at,
  case
    when bucket_type = 'admin_spendable' then '💰 Admin Spendable - Money you can personally spend'
    when bucket_type = 'broadcaster_liability' then '📊 Broadcaster Liability - Money owed to broadcasters (DO NOT SPEND)'
    when bucket_type = 'admin_issued_coins_liability' then '🪙 Admin Issued Coins - Coins granted by admin with payout liability'
    when bucket_type = 'reserved_payout' then '🔒 Reserved Payout - Funds reserved for pending payouts'
    when bucket_type = 'paid_out' then '✅ Paid Out - Total funds paid out to broadcasters'
  end as description
from public.wallet_buckets
order by bucket_type;

-- View: ledger_recent
create or replace view public.ledger_recent as
select
  lt.id,
  lt.transaction_type,
  lt.source_type,
  lt.source_id,
  lt.usd_amount,
  lt.coin_amount,
  lt.admin_spendable_delta,
  lt.broadcaster_liability_delta,
  lt.admin_issued_coins_delta,
  lt.reserved_payout_delta,
  lt.paid_out_delta,
  lt.description,
  lt.metadata,
  lt.created_at,
  up.username as user_username
from public.ledger_transactions lt
left join public.user_profiles up on lt.user_id = up.id
order by lt.created_at desc
limit 100;

-- View: payouts_summary
create or replace view public.payouts_summary as
select
  pr.id,
  pr.user_id,
  up.username,
  pr.coin_amount,
  pr.cash_amount,
  pr.net_amount,
  pr.status,
  pr.funds_check_passed,
  pr.created_at,
  pr.approved_at,
  pr.completed_at
from public.payout_requests pr
join public.user_profiles up on pr.user_id = up.id
order by pr.created_at desc;

-- =============================================================================
-- COMMENTS
-- =============================================================================
comment on table public.wallet_buckets is 'Financial buckets tracking platform funds - admin spendable, broadcaster liability, etc.';
comment on table public.ledger_transactions is 'Immutable ledger of all bucket transactions for audit trail';
comment on table public.payout_requests is 'User payout requests with funds validation and status tracking';
comment on function public.process_paypal_capture_allocation is 'Automatically allocates PayPal capture: $1 to admin_spendable, remainder to broadcaster_liability';
comment on function public.validate_payout_eligibility is 'Validates if payout can proceed based on bucket funds availability';
comment on function public.reserve_payout_funds is 'Reserves funds for payout (broadcaster_liability -> reserved_payout)';
comment on function public.complete_payout is 'Marks payout complete (reserved_payout -> paid_out)';
