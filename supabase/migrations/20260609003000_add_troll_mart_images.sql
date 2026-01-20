-- Update Troll Mart items with local asset URLs (SVG placeholders)
-- These files are expected to be in public/assets/troll-mart/

UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/head_classic.svg' WHERE item_code = 'head_classic';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/head_round.svg' WHERE item_code = 'head_round';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/head_square.svg' WHERE item_code = 'head_square';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/head_alien.svg' WHERE item_code = 'head_alien';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/head_monster.svg' WHERE item_code = 'head_monster';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/head_celestial.svg' WHERE item_code = 'head_celestial';

UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/body_tshirt_white.svg' WHERE item_code = 'body_tshirt_white';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/body_tshirt_black.svg' WHERE item_code = 'body_tshirt_black';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/body_jacket_leather.svg' WHERE item_code = 'body_jacket_leather';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/body_suit_formal.svg' WHERE item_code = 'body_suit_formal';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/body_tuxedo.svg' WHERE item_code = 'body_tuxedo';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/body_armor_knight.svg' WHERE item_code = 'body_armor_knight';

UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/legs_jeans_blue.svg' WHERE item_code = 'legs_jeans_blue';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/legs_jeans_black.svg' WHERE item_code = 'legs_jeans_black';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/legs_shorts.svg' WHERE item_code = 'legs_shorts';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/legs_pants_formal.svg' WHERE item_code = 'legs_pants_formal';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/legs_pants_leather.svg' WHERE item_code = 'legs_pants_leather';

UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/feet_sneakers.svg' WHERE item_code = 'feet_sneakers';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/feet_shoes_dress.svg' WHERE item_code = 'feet_shoes_dress';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/feet_boots.svg' WHERE item_code = 'feet_boots';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/feet_heels.svg' WHERE item_code = 'feet_heels';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/feet_sandals.svg' WHERE item_code = 'feet_sandals';

UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/acc_sunglasses.svg' WHERE item_code = 'acc_sunglasses';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/acc_chain_gold.svg' WHERE item_code = 'acc_chain_gold';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/acc_crown.svg' WHERE item_code = 'acc_crown';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/acc_hat_top.svg' WHERE item_code = 'acc_hat_top';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/acc_hat_cowboy.svg' WHERE item_code = 'acc_hat_cowboy';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/acc_beanie.svg' WHERE item_code = 'acc_beanie';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/acc_pipe.svg' WHERE item_code = 'acc_pipe';
UPDATE troll_mart_clothing SET image_url = '/assets/troll-mart/acc_watch.svg' WHERE item_code = 'acc_watch';
