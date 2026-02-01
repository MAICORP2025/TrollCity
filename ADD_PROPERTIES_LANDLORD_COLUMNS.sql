-- Add missing columns to properties table for landlord functionality
-- Run this migration to enable landlord property management

-- Safely add columns if they don't exist
DO $$
BEGIN
    -- price column for buying properties
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'price') THEN
        ALTER TABLE public.properties ADD COLUMN price INTEGER DEFAULT 0;
    END IF;

    -- is_for_sale column for properties available to buy
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'is_for_sale') THEN
        ALTER TABLE public.properties ADD COLUMN is_for_sale BOOLEAN DEFAULT false;
    END IF;

    -- bedrooms column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'bedrooms') THEN
        ALTER TABLE public.properties ADD COLUMN bedrooms INTEGER DEFAULT 1;
    END IF;

    -- bathrooms column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'bathrooms') THEN
        ALTER TABLE public.properties ADD COLUMN bathrooms INTEGER DEFAULT 1;
    END IF;

    -- sqft column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'sqft') THEN
        ALTER TABLE public.properties ADD COLUMN sqft INTEGER DEFAULT 0;
    END IF;

    -- tenant_capacity column (max tenants the property can hold)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'tenant_capacity') THEN
        ALTER TABLE public.properties ADD COLUMN tenant_capacity INTEGER DEFAULT 1;
    END IF;

    -- current_tenants column (current number of tenants)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'current_tenants') THEN
        ALTER TABLE public.properties ADD COLUMN current_tenants INTEGER DEFAULT 0;
    END IF;

    -- amenities column (array of amenities)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'amenities') THEN
        ALTER TABLE public.properties ADD COLUMN amenities TEXT[] DEFAULT '{}';
    END IF;

    -- image_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'image_url') THEN
        ALTER TABLE public.properties ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Update existing properties to have default values
UPDATE public.properties SET 
    is_for_sale = false,
    bedrooms = 1,
    bathrooms = 1,
    sqft = 500,
    tenant_capacity = 1,
    current_tenants = 0,
    amenities = ARRAY['Basic Amenities']
WHERE price IS NULL OR price = 0;

-- Set default rent_amount if not set
UPDATE public.properties SET rent_amount = 1500 WHERE rent_amount IS NULL OR rent_amount = 0;

-- Set default utility_cost if not set
UPDATE public.properties SET utility_cost = 150 WHERE utility_cost IS NULL OR utility_cost = 0;

COMMENT ON COLUMN public.properties.price IS 'Purchase price for buying the property';
COMMENT ON COLUMN public.properties.is_for_sale IS 'Whether the property is available for purchase';
COMMENT ON COLUMN public.properties.bedrooms IS 'Number of bedrooms';
COMMENT ON COLUMN public.properties.bathrooms IS 'Number of bathrooms';
COMMENT ON COLUMN public.properties.sqft IS 'Square footage of the property';
COMMENT ON COLUMN public.properties.tenant_capacity IS 'Maximum number of tenants the property can hold';
COMMENT ON COLUMN public.properties.current_tenants IS 'Current number of tenants living in the property';
COMMENT ON COLUMN public.properties.amenities IS 'Array of amenities available at the property';
