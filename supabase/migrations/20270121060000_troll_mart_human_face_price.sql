-- Update Troll Mart: Set Human Face price to 150 TrollCoins
-- Creates the human face item if it doesn't exist, or updates price if it does

-- First, ensure the troll_mart_clothing table exists (it should from earlier migrations)
-- Then upsert the human face item

DO $$
BEGIN
  -- Check if troll_mart_clothing table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_mart_clothing') THEN
    
    -- Insert or update the human face item
    INSERT INTO troll_mart_clothing (
      id,
      item_code,
      name,
      description,
      category,
      price_coins,
      sort_order,
      is_active,
      image_url
    ) VALUES (
      gen_random_uuid(),
      'head_human',
      'Human Face',
      'Look like a regular human',
      'head',
      150,
      5,
      true,
      '/assets/troll-mart/head_human.svg'
    )
    ON CONFLICT (item_code) 
    DO UPDATE SET 
      price_coins = 150,
      name = 'Human Face',
      description = 'Look like a regular human',
      is_active = true;

  ELSE
    RAISE NOTICE 'troll_mart_clothing table does not exist yet. Skipping human face price update.';
  END IF;
END $$;
