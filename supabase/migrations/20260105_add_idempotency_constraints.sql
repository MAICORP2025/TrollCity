-- Add unique constraints for idempotency and tracking
-- This ensures we never process the same PayPal order or Capture twice

ALTER TABLE public.coin_transactions
ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Add unique constraint on paypal_order_id
-- We use a partial index to allow nulls (for non-PayPal transactions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_transactions_paypal_order_id 
ON public.coin_transactions(paypal_order_id) 
WHERE paypal_order_id IS NOT NULL;

-- Add unique constraint on external_id (e.g. capture ID)
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_transactions_external_id 
ON public.coin_transactions(external_id) 
WHERE external_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.coin_transactions.paypal_order_id IS 'Unique PayPal Order ID to prevent duplicate processing';
COMMENT ON COLUMN public.coin_transactions.external_id IS 'External payment provider transaction/capture ID';
