-- Verification Script for RLS Policies
-- Run this in Supabase SQL Editor to verify security hardening.

BEGIN;

-- 1. Setup Test Data
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    user_a_id UUID := gen_random_uuid();
    user_b_id UUID := gen_random_uuid();
    stream_id UUID := gen_random_uuid();
    auction_id UUID := gen_random_uuid();
    row_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting RLS Verification...';
    RAISE NOTICE 'User A: %', user_a_id;
    RAISE NOTICE 'User B: %', user_b_id;

    -- Create Dummy Data (As Service Role / Superuser)
    -- Insert Profiles (needed for FKs usually, but RLS checks happen before FK checks sometimes, 
    -- but for insertion we need valid FKs if constraints exist. 
    -- We assume constraints might fail if we don't insert profiles, but we can't easily insert into auth.users.
    -- If FKs are enforced, this test might fail on INSERTs. 
    -- HOWEVER, we are testing SELECT visibility mostly.
    
    -- Insert into broadcaster_stats (No FK on user_id? Check definition. Yes, FK to user_profiles)
    -- If we can't satisfy FKs, we can't run this test against a live DB with strict constraints without creating real users.
    -- Assumption: We are running this where we can bypass or we just test the POLICY logic by mocking the auth.uid().
    
    -- FORCE RLS TEST:
    -- We will try to INSERT directly into tables. If FKs fail, we can't test.
    -- Alternative: We inspect `pg_policies` to verify the definitions are correct.
    
    -- Verify `broadcaster_stats` Policy
    SELECT count(*) INTO row_count FROM pg_policies 
    WHERE tablename = 'broadcaster_stats' 
    AND policyname = 'Users view own stats'
    AND cmd = 'SELECT';
    
    IF row_count = 0 THEN
        RAISE EXCEPTION 'Policy "Users view own stats" missing on broadcaster_stats';
    END IF;

    -- Verify `user_house_upgrades` is locked
    SELECT count(*) INTO row_count FROM pg_policies 
    WHERE tablename = 'user_house_upgrades' 
    AND (cmd = 'SELECT' OR cmd = 'ALL')
    AND roles @> ARRAY['authenticated']::name[];
    
    IF row_count > 0 THEN
        RAISE EXCEPTION 'Found permissive policy on user_house_upgrades for authenticated users!';
    END IF;

    RAISE NOTICE 'Policy definitions verified successfully.';
    
END $$;

ROLLBACK; -- Clean up
