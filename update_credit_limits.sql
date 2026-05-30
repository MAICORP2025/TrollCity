-- Update all users with credit_limit = 0 or NULL to have 250 coins credit limit
UPDATE public.user_profiles 
SET credit_limit = 250
WHERE credit_limit = 0 OR credit_limit IS NULL;

-- Verify the update
SELECT id, username, credit_limit, credit_used, (credit_limit - credit_used) as available_credit
FROM user_profiles 
WHERE credit_limit > 0
ORDER BY credit_limit DESC;