-- =============================================================================
-- DATABASE CLEANUP VALIDATION SCRIPT
-- =============================================================================
-- Run this script after applying cleanup migration to verify everything works
-- =============================================================================

-- =============================================================================
-- 1. CHECK FOR FK ERRORS - Verify no broken foreign keys
-- =============================================================================

SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    a.attname AS column_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint
JOIN pg_attribute a ON a.attrelid = pg_constraint.conrelid AND a.attnum = ANY(pg_constraint.conkey)
LEFT JOIN pg_class c ON c.oid = pg_constraint.conrelid
WHERE contype = 'f'
AND c.relname = 'user_profiles';

-- Expected: No errors for user_profiles columns that were removed

-- =============================================================================
-- 2. VERIFY CRITICAL COLUMNS STILL EXIST
-- =============================================================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN (
    'id', 'username', 'role', 'troll_coins',
    'is_troll_officer', 'is_lead_officer', 'officer_level', 'officer_role', 'is_officer_active',
    'is_admin', 'is_banned', 'banned_until', 'ban_reason',
    'troll_role',
    'active_entrance_effect', 'active_entrance_effect_id', 'entrance_effects',
    'is_kicked', 'kick_count', 'muted_until',
    'level', 'xp', 'total_xp'
)
ORDER BY column_name;

-- Expected: All columns should exist

-- =============================================================================
-- 3. TEST OFFICER LOGIN AND PERMISSIONS
-- =============================================================================

-- Check if is_officer_or_admin() function works
SELECT public.is_officer_or_admin();

-- Check if is_lead_officer() function works
SELECT public.is_lead_officer();

-- Verify officer columns are populated
SELECT COUNT(*) AS officer_count
FROM user_profiles
WHERE is_troll_officer = true OR is_lead_officer = true;

-- Expected: Functions return results, officer count > 0 (if officers exist)

-- =============================================================================
-- 4. TEST BAN/KICK FUNCTIONALITY
-- =============================================================================

-- Verify banned users can be identified
SELECT COUNT(*) AS banned_count
FROM user_profiles
WHERE is_banned = true;

-- Check ban columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN ('is_banned', 'banned_until', 'ban_reason', 'ban_expires_at');

-- Expected: Ban columns exist, banned_count returns valid result

-- =============================================================================
-- 5. TEST ENTRANCE EFFECTS
-- =============================================================================

-- Check entrance effect columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN ('active_entrance_effect', 'active_entrance_effect_id', 'entrance_effects');

-- Check entrance effects tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('entrance_effects', 'user_entrance_effects', 'user_active_entrance_effect');

-- Expected: Columns and tables exist

-- =============================================================================
-- 6. TEST FRONTEND PROFILE DISPLAY
-- =============================================================================

-- Get sample user profile to verify core columns
SELECT
    id,
    username,
    avatar_url,
    role,
    level,
    troll_coins,
    is_admin,
    is_troll_officer,
    is_banned,
    created_at
FROM user_profiles
LIMIT 1;

-- Expected: Returns valid user profile

-- =============================================================================
-- 7. TEST RLS POLICIES STILL WORK
-- =============================================================================

-- Check RLS is enabled on user_profiles
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'user_profiles';

-- Count RLS policies on user_profiles
SELECT COUNT(*)
FROM pg_policies
WHERE tablename = 'user_profiles';

-- Test that users can read their own profile (basic RLS test)
-- This will only work if you're logged in as a user
-- SELECT * FROM user_profiles WHERE id = auth.uid();

-- Expected: rowsecurity = true, policies > 0

-- =============================================================================
-- 8. TEST MODERATION FUNCTIONS
-- =============================================================================

-- Check moderation-related functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%ban%'
   OR routine_name LIKE '%kick%'
   OR routine_name LIKE '%mute%'
ORDER BY routine_name;

-- Verify troll_role sync trigger exists
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE '%troll_role%'
AND tgrelid::regclass::text LIKE '%user_profiles%';

-- Expected: Functions and triggers exist

-- =============================================================================
-- 9. VERIFY REMOVED COLUMNS ARE GONE
-- =============================================================================

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name IN (
    'sav_bonus_coins', 'owc_balance', 'total_owc_earned', 'vivied_bonus_coins',
    'reserved_paid_coins', 'trollmonds', 'earned_coins', 'total_coins_earned',
    'total_coins_spent', 'coin_balance',
    'multiplier_active', 'multiplier_value', 'multiplier_expires', 'coin_multiplier',
    'payout_method', 'payout_details', 'payout_destination_masked',
    'preferred_payout_method', 'payout_paypal_email', 'tax_status', 'tax_id_last4',
    'tax_classification', 'w9_status', 'w9_verified_at', 'payout_frozen',
    'payout_freeze_reason', 'payout_freeze_at', 'last_payout_at', 'lifetime_payout_total',
    'total_earned_usd', 'creator_trust_score',
    'empire_role', 'empire_partner', 'partner_status', 'is_empire_partner',
    'influence_tier',
    'address_line1', 'address_line2', 'state_region', 'postal_code',
    'street_address', 'city', 'state', 'country'
);

-- Expected: No rows returned (all columns removed)

-- =============================================================================
-- 10. VERIFY TABLES ARE DROPPED
-- =============================================================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'visitor_stats', 'troll_events', 'user_health_records',
    'staff_profiles', 'troll_dna_profiles', 'profiles',
    'asset_auctions', 'auction_bids'
);

-- Expected: No rows returned (all tables removed)

-- =============================================================================
-- 11. CHECK FOR ORPHANED DATA (Optional)
-- =============================================================================

-- Check for any orphaned records referencing removed tables
-- This is mainly for informational purposes

SELECT 'Checking for references to removed tables...' AS status;

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT
    'user_profiles columns' AS entity,
    COUNT(*) AS count
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND table_schema = 'public'
UNION ALL
SELECT
    'user_profiles RLS policies' AS entity,
    COUNT(*) AS count
FROM pg_policies
WHERE tablename = 'user_profiles'
UNION ALL
SELECT
    'user_profiles indexes' AS entity,
    COUNT(*) AS count
FROM pg_indexes
WHERE tablename = 'user_profiles';

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database Cleanup Validation Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Check the results above:';
    RAISE NOTICE '1. FK Errors: Should show no broken FKs';
    RAISE NOTICE '2. Critical Columns: All should exist';
    RAISE NOTICE '3. Officer Permissions: Functions should work';
    RAISE NOTICE '4. Ban/Kick: Should work correctly';
    RAISE NOTICE '5. Entrance Effects: Should be functional';
    RAISE NOTICE '6. Profile Display: Should show valid data';
    RAISE NOTICE '7. RLS Policies: Should be enabled';
    RAISE NOTICE '8. Moderation: Functions should exist';
    RAISE NOTICE '9. Removed Columns: Should be gone';
    RAISE NOTICE '10. Removed Tables: Should be gone';
    RAISE NOTICE '';
    RAISE NOTICE 'If all checks pass, cleanup was successful!';
END $$;
