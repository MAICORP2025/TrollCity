-- Add columns for landlord property management
-- Run this migration to enable:
-- 1. Admin-created properties that only landlords can buy
-- 2. Hide landlord-purchased properties from the for-rent section

DO $$
BEGIN
    -- is_admin_created: Property created by admin for landlords to buy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'is_admin_created') THEN
        ALTER TABLE public.properties ADD COLUMN is_admin_created BOOLEAN DEFAULT false;
    END IF;

    -- is_landlord_purchased: Property was purchased by a landlord (hide from rent section)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'is_landlord_purchased') THEN
        ALTER TABLE public.properties ADD COLUMN is_landlord_purchased BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Update existing properties: mark those owned by landlords as already landlord-purchased
-- This ensures existing landlord-owned properties don't disappear from rent section
UPDATE public.properties 
SET is_landlord_purchased = true 
WHERE owner_id IN (
    SELECT id FROM public.user_profiles WHERE is_landlord = true
);

-- Add comments for documentation
COMMENT ON COLUMN public.properties.is_admin_created IS 'Property created by admin specifically for landlords to buy';
COMMENT ON COLUMN public.properties.is_landlord_purchased IS 'Property was purchased by a landlord (should not show in rent section)';
