-- Migration: Remove Trollmonds Entirely

-- 1. Drop Trollmonds tables
DROP TABLE IF EXISTS public.trollmond_transactions CASCADE;
DROP TABLE IF EXISTS public.trollmond_config CASCADE;
DROP TABLE IF EXISTS public.trollmond_holds CASCADE;
DROP TABLE IF EXISTS public.trollmond_cashouts CASCADE;

-- 2. Drop columns from user_profiles
ALTER TABLE public.user_profiles
DROP COLUMN IF EXISTS trollmonds;

-- 3. Drop columns from properties
ALTER TABLE public.properties
DROP COLUMN IF EXISTS last_purchase_price;

-- 4. Clean up gift_items
DELETE FROM public.gift_items WHERE currency = 'trollmonds';

-- 5. Drop functions
DROP FUNCTION IF EXISTS public.mint_trollmonds_internal;
DROP FUNCTION IF EXISTS public.transfer_trollmonds;
DROP FUNCTION IF EXISTS public.send_trollmond_gift;
DROP FUNCTION IF EXISTS public.get_trollmond_status;
DROP FUNCTION IF EXISTS public.request_cashout;
