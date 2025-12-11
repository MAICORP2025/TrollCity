-- Migration for Trollmonds Store and Inventory
-- 1. Add currency column to gift_items
ALTER TABLE gift_items 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'paid' CHECK (currency IN ('paid', 'trollmonds'));

-- 2. Create user_inventory table
CREATE TABLE IF NOT EXISTS user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES gift_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- 3. RPC to purchase item with Trollmonds (adds to inventory)
CREATE OR REPLACE FUNCTION purchase_inventory_item(
  p_user_id uuid,
  p_item_id uuid,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_price bigint;
  v_item_currency text;
  v_total_cost bigint;
  v_balance bigint;
  v_inventory_id uuid;
BEGIN
  -- Get item details
  SELECT value, currency INTO v_item_price, v_item_currency
  FROM gift_items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Item not found');
  END IF;

  IF v_item_currency != 'trollmonds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Trollmonds items can be purchased for inventory');
  END IF;

  v_total_cost := v_item_price * p_quantity;

  -- Check balance (free_coin_balance is Trollmonds)
  SELECT free_coin_balance INTO v_balance
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_balance < v_total_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient Trollmonds');
  END IF;

  -- Deduct Trollmonds
  UPDATE user_profiles
  SET free_coin_balance = free_coin_balance - v_total_cost,
      updated_at = now()
  WHERE id = p_user_id;

  -- Add to inventory
  INSERT INTO user_inventory (user_id, item_id, quantity)
  VALUES (p_user_id, p_item_id, p_quantity)
  ON CONFLICT (user_id, item_id)
  DO UPDATE SET quantity = user_inventory.quantity + p_quantity, updated_at = now()
  RETURNING id INTO v_inventory_id;

  -- Log transaction
  INSERT INTO coin_transactions (
    user_id,
    type,
    coins,
    coin_type,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'store_purchase',
    -v_total_cost,
    'free',
    'Purchased item from Trollmonds Store',
    jsonb_build_object('item_id', p_item_id, 'quantity', p_quantity)
  );

  RETURN jsonb_build_object('success', true, 'inventory_id', v_inventory_id, 'new_balance', v_balance - v_total_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION purchase_inventory_item(uuid, uuid, integer) TO authenticated;

-- 4. Seed some Trollmonds gifts
INSERT INTO gift_items (name, icon, value, currency, category, description) VALUES
  ('Troll Cookie', '🍪', 10, 'trollmonds', 'Small Gifts', 'A small snack for a troll'),
  ('High Five', '✋', 15, 'trollmonds', 'Small Gifts', 'Virtual high five'),
  ('Confetti', '🎊', 25, 'trollmonds', 'Fun Animations', 'Party time!'),
  ('Cool Shades', '😎', 30, 'trollmonds', 'Chat Stickers', 'Deal with it'),
  ('Troll Laugh', '😆', 40, 'trollmonds', 'Chat Stickers', 'Classic troll laugh'),
  ('Mini Sparkle', '✨', 50, 'trollmonds', 'Mini Effects', 'Shiny!')
ON CONFLICT DO NOTHING;
