-- Drop unused tables
-- Run this in Supabase SQL Editor to remove unused tables

-- Drop wheel_spins table
DROP TABLE IF EXISTS public.wheel_spins;

-- Drop lucky_trollmond_events table
DROP TABLE IF EXISTS public.lucky_trollmond_events;

-- Verify tables are gone
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('wheel_spins', 'lucky_trollmond_events');
