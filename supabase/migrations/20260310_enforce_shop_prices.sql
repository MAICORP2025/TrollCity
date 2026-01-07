-- Enforce prices for all family shop items
DO $$
BEGIN
    -- 1. Set default 0 for any NULL costs (safety check)
    UPDATE family_shop_items 
    SET cost_family_coins = 0 
    WHERE cost_family_coins IS NULL;

    UPDATE family_shop_items 
    SET cost_family_xp = 0 
    WHERE cost_family_xp IS NULL;

    -- 2. Enforce NOT NULL constraints
    ALTER TABLE family_shop_items 
    ALTER COLUMN cost_family_coins SET NOT NULL;

    ALTER TABLE family_shop_items 
    ALTER COLUMN cost_family_xp SET NOT NULL;
    
    -- 3. Set default values for future inserts
    ALTER TABLE family_shop_items 
    ALTER COLUMN cost_family_coins SET DEFAULT 0;

    ALTER TABLE family_shop_items 
    ALTER COLUMN cost_family_xp SET DEFAULT 0;

EXCEPTION WHEN OTHERS THEN
    -- If constraints already exist or other errors, log but don't fail hard
    RAISE NOTICE 'Error enforcing price constraints: %', SQLERRM;
END $$;
