-- Migration: Create payment_logs table for PayPal transaction tracking
-- This table provides idempotency protection and audit trail for all PayPal purchases

-- Create payment_logs table with comprehensive fields for tracking
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- PayPal identifiers (primary idempotency keys)
  paypal_order_id TEXT NOT NULL,
  paypal_capture_id TEXT,
  
  -- User and package info
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.coin_packages(id) ON DELETE SET NULL,
  
  -- Transaction status
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
  
  -- Financial details
  amount_usd DECIMAL(10, 2) NOT NULL,
  coins_granted INTEGER DEFAULT 0,
  
  -- Error tracking (populated when status = FAILED)
  error_code TEXT,
  error_message TEXT,
  raw_response JSONB,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Constraints for idempotency
  CONSTRAINT unique_paypal_order_id UNIQUE (paypal_order_id)
);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON public.payment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status ON public.payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created_at ON public.payment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_paypal_order ON public.payment_logs(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_paypal_capture ON public.payment_logs(paypal_capture_id);

-- Enable Row Level Security
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view all payment logs
DROP POLICY IF EXISTS "admins_can_view_all_payments" ON public.payment_logs;
CREATE POLICY "admins_can_view_all_payments" ON public.payment_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- Admins can update payment logs
DROP POLICY IF EXISTS "admins_can_update_payments" ON public.payment_logs;
CREATE POLICY "admins_can_update_payments" ON public.payment_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

-- System/service role can insert (for Edge Functions)
DROP POLICY IF EXISTS "service_role_can_insert" ON public.payment_logs;
CREATE POLICY "service_role_can_insert" ON public.payment_logs
  FOR INSERT WITH CHECK (true);

-- System/service role can update (for Edge Functions)
DROP POLICY IF EXISTS "service_role_can_update" ON public.payment_logs;
CREATE POLICY "service_role_can_update" ON public.payment_logs
  FOR UPDATE USING (true);

-- Users can view their own payment logs
DROP POLICY IF EXISTS "users_can_view_own_payments" ON public.payment_logs;
CREATE POLICY "users_can_view_own_payments" ON public.payment_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_payment_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_payment_logs_updated_at ON public.payment_logs;

-- Create trigger for auto-updating updated_at
CREATE TRIGGER trigger_payment_logs_updated_at
  BEFORE UPDATE ON public.payment_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payment_logs_updated_at();

-- Create function to update platform revenue dashboard
-- This will be called after successful payment fulfillment
CREATE OR REPLACE FUNCTION public.update_platform_revenue_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' THEN
    -- Update platform_revenue table
    INSERT INTO public.platform_revenue (date, total_revenue, transaction_count)
    VALUES (CURRENT_DATE, NEW.amount_usd, 1)
    ON CONFLICT (date) DO UPDATE
    SET 
      total_revenue = platform_revenue.total_revenue + NEW.amount_usd,
      transaction_count = platform_revenue.transaction_count + 1,
      updated_at = NOW();
    
    -- Update platform_profit table (assuming 10% platform fee)
    DECLARE
      v_platform_fee DECIMAL(10, 2) := NEW.amount_usd * 0.10;
    BEGIN
      INSERT INTO public.platform_profit (date, total_profit, payment_count)
      VALUES (CURRENT_DATE, v_platform_fee, 1)
      ON CONFLICT (date) DO UPDATE
      SET 
        total_profit = platform_profit.total_profit + v_platform_fee,
        payment_count = platform_profit.payment_count + 1,
        updated_at = NOW();
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for platform revenue/profit updates
DROP TRIGGER IF EXISTS trigger_payment_revenue_update ON public.payment_logs;
CREATE TRIGGER trigger_payment_revenue_update
  AFTER INSERT OR UPDATE OF status ON public.payment_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_platform_revenue_on_payment();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.payment_logs TO anon, authenticated, service_role;

-- Add comments for documentation
COMMENT ON TABLE public.payment_logs IS 'Comprehensive PayPal transaction logging with idempotency protection and audit trail';
COMMENT ON COLUMN public.payment_logs.paypal_order_id IS 'PayPal order ID - primary idempotency key';
COMMENT ON COLUMN public.payment_logs.paypal_capture_id IS 'PayPal capture ID - secondary idempotency key';
COMMENT ON COLUMN public.payment_logs.status IS 'Transaction status: PENDING, COMPLETED, FAILED, REFUNDED';
COMMENT ON COLUMN public.payment_logs.error_code IS 'Error code when status = FAILED';
COMMENT ON COLUMN public.payment_logs.error_message IS 'Error message when status = FAILED';
COMMENT ON COLUMN public.payment_logs.raw_response IS 'Full PayPal API response JSON for debugging';

-- Note: Ensure platform_revenue and platform_profit tables exist
-- If they don't exist, create them:
CREATE TABLE IF NOT EXISTS public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.platform_profit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  total_profit DECIMAL(12, 2) DEFAULT 0,
  payment_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
