-- Migration to update family_shop_items with the new catalog (v2) based on user specific list
-- Replaces all previous shop items
-- Uses granular unlock_types to match user's specific categories

-- Ensure columns exist (idempotent check)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_shop_items' AND column_name = 'cost_family_xp') THEN 
        ALTER TABLE family_shop_items ADD COLUMN cost_family_xp INTEGER DEFAULT 0; 
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_shop_items' AND column_name = 'is_limited') THEN 
        ALTER TABLE family_shop_items ADD COLUMN is_limited BOOLEAN DEFAULT false; 
    END IF;
END $$;

-- Clear existing items
DELETE FROM family_shop_items;

-- Insert new items
INSERT INTO family_shop_items (
    name, 
    description, 
    cost_family_coins, 
    cost_family_xp, 
    unlock_type, 
    is_consumable, 
    is_active,
    is_limited
) VALUES 
-- LIMITED EDITION (Top Section)
('Verified Family Application Token (Limited Edition)', 'Allows family to apply for verified badge', 5000, 0, 'prestige', true, true, true),
('Founder Family Trophy (Limited)', 'Permanent “Founder Family” trophy on page', 20000, 0, 'prestige', false, true, true),

-- SPOTLIGHT / PLACEMENT BOOSTS
('Family Spotlight (1 Hour)', '+15% family placement for 1 hour', 350, 0, 'boost', true, true, false),
('Family Spotlight (24 Hours)', '+15% family placement for 24 hours', 1400, 0, 'boost', true, true, false),
('Family Takeover (24 Hours)', '+30% placement for 24 hours', 3800, 0, 'boost', true, true, false),
('Recruitment Boost (7 Days)', 'Appears in “Suggested Families” feed all week', 7500, 0, 'boost', true, true, false),
('Elite Placement (7 Days)', '+25% placement for 7 days (max 1 active at a time)', 12500, 0, 'boost', true, true, false),

-- WAR BOOSTS
('War Banner (1 Hour)', '+10% war points for 1 hour', 450, 0, 'war_item', true, true, false),
('War Banner (24 Hours)', '+10% war points for 24 hours', 1800, 0, 'war_item', true, true, false),
('Family Raid Pass (3 Uses)', 'Allows raiding a stream for bonus war points (3 uses)', 4200, 0, 'war_item', true, true, false),
('War Drum (24 Hours)', '+20% war points for 24 hours', 6800, 0, 'war_item', true, true, false),
('Victory Surge (7 Days)', '+15% war points for 7 days', 14000, 0, 'war_item', true, true, false),

-- COSMETIC UPGRADES
('Banner Upgrade — Gold Trim', 'Adds a gold trim to your family banner', 2200, 0, 'cosmetic', false, true, false),
('Banner Upgrade — Animated', 'Adds animation effects to your family banner', 9500, 0, 'cosmetic', false, true, false),
('Emblem Frame — Neon', 'Neon frame for your family emblem', 3100, 0, 'cosmetic', false, true, false),
('Emblem Frame — Diamond', 'Diamond frame for your family emblem', 12800, 0, 'cosmetic', false, true, false),
('Theme Pack — Purple Night', 'Unlocks Purple Night theme for family page', 4400, 0, 'cosmetic', false, true, false),
('Theme Pack — Gold Royale', 'Unlocks Gold Royale theme for family page', 5600, 0, 'cosmetic', false, true, false),
('Theme Pack — Cyber City', 'Unlocks Cyber City theme for family page', 7900, 0, 'cosmetic', false, true, false),
('Family Page Glow Effect', 'Adds a glow effect to your family page', 8700, 0, 'cosmetic', false, true, false),
('Family Background — Hologram Grid', 'Hologram Grid background for family page', 11200, 0, 'cosmetic', false, true, false),
('Family Trophy Shelf', 'Displays trophies & war wins on profile', 14500, 0, 'cosmetic', false, true, false),

-- OFFICER / LEADERSHIP UPGRADES
('Extra Officer Slot (+1)', 'Adds 1 additional officer slot', 6900, 0, 'officer', false, true, false),
('Extra Officer Slots (+3)', 'Adds 3 additional officer slots', 19500, 0, 'officer', false, true, false),
('Family Shoutout System (3/day)', 'Family announcements show on family wall', 24500, 0, 'officer', false, true, false),
('Pinned Announcements Upgrade (2 pins)', 'Pin up to 2 announcements', 13800, 0, 'officer', false, true, false),
('Family Role Titles Pack', 'Unlock titles: Captain, Enforcer, General, Elder, etc.', 9200, 0, 'officer', false, true, false),

-- EMOTES / SOCIAL PACKS
('Family Emotes Pack #1', 'Basic family emotes pack', 2700, 0, 'social', false, true, false),
('Family Emotes Pack #2 (Epic)', 'Epic family emotes pack', 11700, 0, 'social', false, true, false),

-- FAMILY FEATURES / ENGAGEMENT SYSTEMS
('Family Voice Room Unlock (Coming Soon)', 'Unlocks family voice room feature', 18000, 0, 'feature', false, true, false),
('Family Poll System Unlock', 'Unlocks polling system for family', 6500, 0, 'feature', false, true, false),
('Family Event Scheduler Unlock', 'Unlocks event scheduler', 14800, 0, 'feature', false, true, false),

-- VAULT / REWARDS / ECONOMY TOOLS
('Vault Ledger Unlock (Level 1)', 'Shows full Vault transaction history', 16500, 0, 'economy', false, true, false),
('Vault Ledger Unlock (Level 2)', 'Allows weekly reward distributions', 32000, 0, 'economy', false, true, false),
('Reward Drops (10 Packs)', 'Leaders can drop 10 Vault Coin packets to members', 19000, 0, 'economy', true, true, false),
('Reward Drops (50 Packs)', 'Leaders can drop 50 Vault Coin packets to members', 72000, 0, 'economy', true, true, false),

-- XP / PROGRESSION BOOSTS
('Family XP Booster (24 Hours)', '+15% family XP for 24 hours', 4400, 0, 'xp_boost', true, true, false),

-- LEGENDARY FAMILY EFFECTS
('Crown Aura (Legendary Family Effect)', 'Legendary Crown Aura effect', 60000, 0, 'legendary', false, true, false),
('Family Hall Entrance Animation', 'Special entrance animation for family hall', 28000, 0, 'legendary', false, true, false),
('Family Name Glow (Legendary)', 'Legendary glow effect for family name', 42000, 0, 'legendary', false, true, false);
