-- Update cashout tiers to match frontend configuration
-- This script should be run against the Supabase database

-- First, deactivate all existing tiers
UPDATE public.cashout_tiers SET is_active = false;

-- Insert/update the new tiers
INSERT INTO public.cashout_tiers (coin_amount, cash_amount, currency, processing_fee_percentage, is_active, created_at, updated_at)
VALUES 
  (7500, 25.00, 'USD', 0, true, NOW(), NOW()),
  (15000, 50.00, 'USD', 0, true, NOW(), NOW()),
  (30000, 150.00, 'USD', 0, true, NOW(), NOW()),
  (60000, 300.00, 'USD', 0, true, NOW(), NOW()),
  (120000, 600.00, 'USD', 0, true, NOW(), NOW()),
  (200000, 1000.00, 'USD', 0, true, NOW(), NOW()),
  (400000, 2000.00, 'USD', 0, true, NOW(), NOW()),
  (600000, 3000.00, 'USD', 0, true, NOW(), NOW())
ON CONFLICT (coin_amount) 
DO UPDATE SET 
  cash_amount = EXCLUDED.cash_amount,
  currency = EXCLUDED.currency,
  processing_fee_percentage = EXCLUDED.processing_fee_percentage,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verify the update
SELECT * FROM public.cashout_tiers ORDER BY coin_amount;