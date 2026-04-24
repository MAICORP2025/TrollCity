-- Clear neighborhood data for admin user to allow starting over
UPDATE user_profiles
SET neighborhood_id = NULL,
    house_id = NULL
WHERE id = '8dff9f37-21b5-4b8e-adc2-b9286874be1a';

-- Optionally delete any remaining neighborhood-related data if it exists
-- Note: This assumes you've already deleted the main neighborhood record from Supabase