-- Migration to update family shop with new currency (XP) and items

-- 1. Add new columns to family_shop_items
ALTER TABLE public.family_shop_items 
ADD COLUMN IF NOT EXISTS cost_family_xp BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_consumable BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Drop the unique constraint on purchases to allow consumables to be bought multiple times
ALTER TABLE public.family_shop_purchases 
DROP CONSTRAINT IF EXISTS family_shop_purchases_family_id_item_id_key;

-- 3. Clear existing items to avoid duplicates/conflicts (optional, but cleaner for a catalog reset)
-- We'll just deactivate them instead of deleting to preserve history if any
UPDATE public.family_shop_items SET is_active = false WHERE is_active = true;

-- 4. Insert new catalog items
INSERT INTO public.family_shop_items (name, description, cost_family_coins, cost_family_xp, unlock_type, unlock_key, is_consumable) VALUES
-- FAMILY BOOSTS
('Family Spotlight (1 Hour)', 'Boosts family placement by +15% for 1 hour.', 2500, 0, 'boost', 'spotlight_1h', true),
('Family Spotlight (24 Hours)', 'Boosts family placement by +15% for 24 hours.', 10000, 0, 'boost', 'spotlight_24h', true),
('Family Takeover (24 Hours)', 'Massive +30% placement boost for 24 hours.', 25000, 500, 'boost', 'takeover_24h', true),
('Recruitment Boost (7 Days)', 'Appears in "Suggested Families" feed all week.', 35000, 0, 'boost', 'recruitment_boost_7d', true),
('Elite Placement (7 Days)', '+25% placement for 7 days (max 1 active at a time).', 60000, 1000, 'boost', 'elite_placement_7d', true),

-- FAMILY WAR ITEMS
('War Banner (1 Hour)', '+10% war points for 1 hour.', 5000, 0, 'war_item', 'war_banner_1h', true),
('War Banner (24 Hours)', '+10% war points for 24 hours.', 20000, 0, 'war_item', 'war_banner_24h', true),
('Family Raid Pass (3 Uses)', 'Allows raiding a stream for bonus war points (3 uses).', 12000, 0, 'war_item', 'raid_pass_3', true),
('War Drum (24 Hours)', '+20% war points for 24 hours.', 25000, 0, 'war_item', 'war_drum_24h', true),
('Victory Surge (7 Days)', '+15% war points for 7 days.', 75000, 2000, 'war_item', 'victory_surge_7d', true),

-- FAMILY COSMETICS
('Banner Upgrade — Gold Trim', 'Adds a gold trim to your family banner.', 5000, 0, 'cosmetic', 'banner_gold_trim', false),
('Banner Upgrade — Animated', 'Animate your family banner.', 25000, 0, 'cosmetic', 'banner_animated', false),
('Emblem Frame — Neon', 'Neon glow frame for your family emblem.', 10000, 0, 'cosmetic', 'emblem_neon', false),
('Emblem Frame — Diamond', 'Diamond frame for your family emblem.', 50000, 0, 'cosmetic', 'emblem_diamond', false),
('Theme Pack — Purple Night', 'Purple Night theme for family page.', 12000, 0, 'cosmetic', 'theme_purple_night', false),
('Theme Pack — Gold Royale', 'Gold Royale theme for family page.', 25000, 0, 'cosmetic', 'theme_gold_royale', false),
('Theme Pack — Cyber City', 'Cyber City theme for family page.', 35000, 0, 'cosmetic', 'theme_cyber_city', false),
('Family Page Glow Effect', 'Adds a glow effect to your family page.', 7500, 0, 'cosmetic', 'page_glow', false),
('Family Background — Hologram Grid', 'Holographic grid background.', 15000, 0, 'cosmetic', 'bg_hologram', false),
('Family Trophy Shelf', 'Displays trophies & war wins on profile.', 20000, 0, 'cosmetic', 'trophy_shelf', false),

-- FAMILY PERKS
('Extra Officer Slot (+1)', 'Add 1 additional officer slot.', 25000, 1000, 'perk', 'extra_officer_1', true),
('Extra Officer Slots (+3)', 'Add 3 additional officer slots.', 60000, 3000, 'perk', 'extra_officer_3', true),
('Family Shoutout System (3/day)', 'Post 3 announcements per day to family wall.', 10000, 0, 'perk', 'shoutout_system', false),
('Pinned Announcements Upgrade (2 pins)', 'Pin up to 2 announcements.', 15000, 0, 'perk', 'pinned_announcements', false),
('Family Emotes Pack #1', 'Unlock basic family emotes.', 5000, 0, 'perk', 'emotes_pack_1', false),
('Family Emotes Pack #2 (Epic)', 'Unlock epic family emotes.', 15000, 0, 'perk', 'emotes_pack_2', false),
('Family Voice Room Unlock', 'Unlock family voice channels.', 25000, 0, 'perk', 'voice_room', false),
('Family Poll System Unlock', 'Create polls for family members.', 10000, 0, 'perk', 'poll_system', false),
('Family Event Scheduler Unlock', 'Schedule family events.', 12000, 0, 'perk', 'event_scheduler', false),
('Family Role Titles Pack', 'Unlock custom titles: Captain, Enforcer, General, Elder.', 20000, 0, 'perk', 'role_titles', false),

-- FAMILY ECONOMY TOOLS
('Vault Ledger Unlock (Level 1)', 'See full Vault transaction history.', 20000, 0, 'economy', 'ledger_l1', false),
('Vault Ledger Unlock (Level 2)', 'Allows weekly reward distributions.', 50000, 1500, 'economy', 'ledger_l2', false),
('Reward Drops (10 Packs)', '10 Vault Coin packets to drop to members.', 10000, 0, 'economy', 'reward_drops_10', true),
('Reward Drops (50 Packs)', '50 Vault Coin packets to drop to members.', 40000, 0, 'economy', 'reward_drops_50', true),
('Family XP Booster (24 Hours)', '+15% family XP for 24 hours.', 15000, 0, 'economy', 'xp_booster_24h', true),

-- PRESTIGE / LEGENDARY
('Verified Family Application Token', 'Apply for Verified Family status.', 100000, 0, 'prestige', 'verified_token', true),
('Crown Aura', 'Legendary Crown Aura effect.', 120000, 0, 'prestige', 'crown_aura', false),
('Family Hall Entrance Animation', 'Special entrance animation.', 75000, 0, 'prestige', 'entrance_animation', false),
('Family Name Glow (Legendary)', 'Legendary glow for family name.', 60000, 0, 'prestige', 'name_glow', false),
('Founder Family Trophy', 'Permanent "Founder Family" trophy.', 250000, 0, 'prestige', 'founder_trophy', false);
