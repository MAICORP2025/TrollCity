-- Clear ALL neighborhood data from the database
-- This script resets the entire neighborhood system so everyone can start fresh
-- Run this as a Supabase admin or through the SQL editor

-- IMPORTANT: This will DELETE all neighborhood-related data permanently!
-- Make sure you have backups if needed

BEGIN;

-- 1. Clear all references from user_profiles FIRST (due to foreign keys)
UPDATE user_profiles
SET 
    neighborhood_id = NULL,
    house_id = NULL,
    vehicle_id = NULL,
    license_id = NULL,
    troll_avatar_url = NULL,
    drivers_test_passed = FALSE,
    homeowners_insurance_expiry = NULL,
    car_insurance_expiry = NULL,
    license_plate = NULL
WHERE neighborhood_id IS NOT NULL 
   OR house_id IS NOT NULL 
   OR vehicle_id IS NOT NULL 
   OR license_id IS NOT NULL;

-- 2. Delete all neighborhood_invites
DELETE FROM neighborhood_invites;

-- 3. Delete all neighborhood_members
DELETE FROM neighborhood_members;

-- 4. Delete all house_raids
DELETE FROM house_raids;

-- 5. Delete all house_loans
DELETE FROM house_loans;

-- 6. Delete all house_upgrades
DELETE FROM house_upgrades;

-- 7. Delete all houses
DELETE FROM houses;

-- 8. Delete all neighborhoods (this should be done after clearing members and houses)
DELETE FROM neighborhoods;

-- 9. Delete all car_insurances
DELETE FROM car_insurances;

-- 10. Delete all broadcast_insurances
DELETE FROM broadcast_insurances;

-- 11. Delete all homeowners_insurances
DELETE FROM homeowners_insurances;

-- 12. Delete all user_licenses
DELETE FROM user_licenses;

-- 13. Delete all driver_tests
DELETE FROM driver_tests;

-- 14. Delete all vehicle_loans
DELETE FROM vehicle_loans;

-- 15. Delete all vehicles
DELETE FROM vehicles;

COMMIT;

-- Verify the cleanup
SELECT 
    'neighborhoods' as table_name, COUNT(*) as count FROM neighborhoods
UNION ALL
SELECT 'neighborhood_members', COUNT(*) FROM neighborhood_members
UNION ALL
SELECT 'houses', COUNT(*) FROM houses
UNION ALL
SELECT 'house_upgrades', COUNT(*) FROM house_upgrades
UNION ALL
SELECT 'house_loans', COUNT(*) FROM house_loans
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'vehicle_loans', COUNT(*) FROM vehicle_loans
UNION ALL
SELECT 'driver_tests', COUNT(*) FROM driver_tests
UNION ALL
SELECT 'user_licenses', COUNT(*) FROM user_licenses
UNION ALL
SELECT 'neighborhood_invites', COUNT(*) FROM neighborhood_invites
UNION ALL
SELECT 'house_raids', COUNT(*) FROM house_raids
UNION ALL
SELECT 'homeowners_insurances', COUNT(*) FROM homeowners_insurances
UNION ALL
SELECT 'car_insurances', COUNT(*) FROM car_insurances
UNION ALL
SELECT 'broadcast_insurances', COUNT(*) FROM broadcast_insurances
UNION ALL
SELECT 'user_profiles (with neighborhood data)', COUNT(*) FROM user_profiles WHERE neighborhood_id IS NOT NULL OR house_id IS NOT NULL OR vehicle_id IS NOT NULL;
