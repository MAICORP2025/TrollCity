-- Relax admin_pool_transactions FK for local/dev seeding
ALTER TABLE IF EXISTS public.admin_pool_transactions
  DROP CONSTRAINT IF EXISTS admin_pool_transactions_user_id_fkey;

ALTER TABLE IF EXISTS public.admin_pool_transactions
  ADD CONSTRAINT admin_pool_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
