-- Seed new gift items into purchasable_items
-- Includes categories and prices as requested

DO $$
DECLARE
    v_gift_category text := 'gift';
BEGIN
    -- Ensure purchasable_items table exists (it should, but for safety)
    CREATE TABLE IF NOT EXISTS public.purchasable_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        item_key TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        category TEXT NOT NULL,
        coin_price INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        is_coin_pack BOOLEAN DEFAULT false,
        frontend_source TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Helper temp table for data
    CREATE TEMP TABLE IF NOT EXISTS temp_gifts (
        item_key TEXT,
        display_name TEXT,
        coin_price INTEGER,
        subcategory TEXT,
        icon TEXT
    );

    -- Insert data into temp table
    INSERT INTO temp_gifts (subcategory, item_key, display_name, coin_price, icon) VALUES
    -- Court & Government Gifts
    ('Court & Government', 'court_gavel', 'Court Gavel', 25, '⚖️'),
    ('Court & Government', 'law_book', 'Law Book', 60, '📖'),
    ('Court & Government', 'jury_vote', 'Jury Vote', 120, '🗳️'),
    ('Court & Government', 'police_siren', 'Police Siren', 250, '🚨'),
    ('Court & Government', 'arrest_warrant', 'Arrest Warrant', 400, '📃'),
    ('Court & Government', 'judge_chair', 'Judge’s Chair', 750, '🪑'),
    ('Court & Government', 'city_seal', 'City Seal', 1500, '🏵️'),
    ('Court & Government', 'presidential_decree', 'Presidential Decree', 3000, '📜'),

    -- Podcast & Media Gifts
    ('Podcast & Media', 'mic_check', 'Mic Check', 30, '🎤'),
    ('Podcast & Media', 'studio_headphones', 'Studio Headphones', 80, '🎧'),
    ('Podcast & Media', 'podcast_camera', 'Podcast Camera', 180, '📹'),
    ('Podcast & Media', 'soundboard', 'Soundboard', 350, '🎛️'),
    ('Podcast & Media', 'live_studio', 'Live Studio', 700, '🎙️'),
    ('Podcast & Media', 'trending_clip', 'Trending Clip', 1200, '📈'),
    ('Podcast & Media', 'viral_moment', 'Viral Moment', 2500, '🚀'),

    -- Homes & Real Estate Gifts
    ('Homes & Real Estate', 'cardboard_box', 'Cardboard Box', 15, '📦'),
    ('Homes & Real Estate', 'starter_apartment', 'Starter Apartment', 120, '🏢'),
    ('Homes & Real Estate', 'city_condo', 'City Condo', 350, '🏙️'),
    ('Homes & Real Estate', 'duplex', 'Duplex', 700, '🏘️'),
    ('Homes & Real Estate', 'suburban_house', 'Suburban House', 1200, '🏡'),
    ('Homes & Real Estate', 'mansion', 'Mansion', 3500, '🏰'),
    ('Homes & Real Estate', 'gated_estate', 'Gated Estate', 7500, '⛩️'),
    ('Homes & Real Estate', 'troll_tower', 'Troll Tower', 15000, '🗽'),

    -- Vehicles & Transport Gifts
    ('Vehicles & Transport', 'bicycle', 'Bicycle', 40, '🚲'),
    ('Vehicles & Transport', 'scooter', 'Scooter', 90, '🛴'),
    ('Vehicles & Transport', 'beater_car', 'Beater Car', 220, '🚗'),
    ('Vehicles & Transport', 'sports_car', 'Sports Car', 650, '🏎️'),
    ('Vehicles & Transport', 'police_cruiser', 'Police Cruiser', 1100, '🚓'),
    ('Vehicles & Transport', 'armored_suv', 'Armored SUV', 2500, '🚙'),
    ('Vehicles & Transport', 'supercar', 'Supercar', 6000, '🏎️💨'),
    ('Vehicles & Transport', 'private_jet', 'Private Jet', 12000, '✈️'),

    -- Money & Flex Gifts
    ('Money & Flex', 'loose_change', 'Loose Change', 10, '🪙'),
    ('Money & Flex', 'cash_stack', 'Cash Stack', 50, '💵'),
    ('Money & Flex', 'money_bag', 'Money Bag', 150, '💰'),
    ('Money & Flex', 'gold_bar', 'Gold Bar', 400, 'or'),
    ('Money & Flex', 'briefcase', 'Briefcase', 900, '💼'),
    ('Money & Flex', 'bank_vault', 'Bank Vault', 2000, '🏦'),
    ('Money & Flex', 'city_treasury', 'City Treasury', 5000, '🏛️'),
    ('Money & Flex', 'troll_fortune', 'Troll Fortune', 10000, '💎'),

    -- Battle & Chaos Gifts
    ('Battle & Chaos', 'tomato_throw', 'Tomato Throw', 20, '🍅'),
    ('Battle & Chaos', 'smoke_bomb', 'Smoke Bomb', 60, '💨'),
    ('Battle & Chaos', 'rage_meter', 'Rage Meter', 150, '🤬'),
    ('Battle & Chaos', 'power_surge', 'Power Surge', 300, '⚡'),
    ('Battle & Chaos', 'knockout_bell', 'Knockout Bell', 700, '🔔'),
    ('Battle & Chaos', 'chaos_crate', 'Chaos Crate', 1500, '📦💥'),
    ('Battle & Chaos', 'city_shake', 'City Shake', 3000, '🌍'),
    ('Battle & Chaos', 'total_anarchy', 'Total Anarchy', 6500, '🏴‍☠️'),

    -- Luxury / Rare Gifts
    ('Luxury / Rare', 'diamond_ring', 'Diamond Ring', 1000, '💍'),
    ('Luxury / Rare', 'gold_throne', 'Gold Throne', 3000, '👑'),
    ('Luxury / Rare', 'crown_of_troll_city', 'Crown of Troll City', 7000, '🤴'),
    ('Luxury / Rare', 'private_island', 'Private Island', 15000, '🏝️'),
    ('Luxury / Rare', 'city_ownership_deed', 'City Ownership Deed', 30000, '📜🔑');

    -- Insert or Update items
    INSERT INTO public.purchasable_items (
        item_key, 
        display_name, 
        category, 
        coin_price, 
        is_active, 
        metadata
    )
    SELECT 
        item_key,
        display_name,
        v_gift_category,
        coin_price,
        true,
        jsonb_build_object(
            'subcategory', subcategory,
            'icon', icon,
            'animation_type', 'standard' -- Default, can be customized later
        )
    FROM temp_gifts
    ON CONFLICT (item_key) 
    DO UPDATE SET
        display_name = EXCLUDED.display_name,
        coin_price = EXCLUDED.coin_price,
        category = EXCLUDED.category,
        metadata = purchasable_items.metadata || EXCLUDED.metadata,
        is_active = true;

    -- Drop temp table
    DROP TABLE temp_gifts;
    
END $$;
