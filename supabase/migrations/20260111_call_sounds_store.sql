-- Call sounds catalog + purchases
CREATE TABLE IF NOT EXISTS public.call_sound_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  sound_type text NOT NULL, -- 'ringtone' | 'dialtone'
  asset_url text NOT NULL,
  price_coins integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_sound_catalog_active ON public.call_sound_catalog(is_active, sound_type);

CREATE TABLE IF NOT EXISTS public.user_call_sounds (
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sound_id uuid NOT NULL REFERENCES public.call_sound_catalog(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sound_id)
);

CREATE INDEX IF NOT EXISTS idx_user_call_sounds_user ON public.user_call_sounds(user_id);

ALTER TABLE public.call_sound_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_call_sounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_sound_catalog_read" ON public.call_sound_catalog;
CREATE POLICY "call_sound_catalog_read"
  ON public.call_sound_catalog
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "call_sound_catalog_admin_write" ON public.call_sound_catalog;
CREATE POLICY "call_sound_catalog_admin_write"
  ON public.call_sound_catalog
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
  );

DROP POLICY IF EXISTS "user_call_sounds_read" ON public.user_call_sounds;
CREATE POLICY "user_call_sounds_read"
  ON public.user_call_sounds
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_call_sounds_write" ON public.user_call_sounds;
CREATE POLICY "user_call_sounds_write"
  ON public.user_call_sounds
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'coin_transactions'
      AND constraint_name = 'coin_transactions_type_check'
  ) THEN
    ALTER TABLE public.coin_transactions DROP CONSTRAINT coin_transactions_type_check;
    ALTER TABLE public.coin_transactions
      ADD CONSTRAINT coin_transactions_type_check CHECK (
        type IN (
          'store_purchase',
          'perk_purchase',
          'gift_send',
          'gift_receive',
          'kick_fee',
          'ban_fee',
          'cashout',
          'wheel_spin',
          'insurance_purchase',
          'broadcast_theme_purchase',
          'call_sound_purchase'
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_call_sound(
  p_user_id uuid,
  p_sound_id uuid,
  p_set_active boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price integer := 0;
  v_slug text;
  v_type text;
  v_balance integer := 0;
BEGIN
  SELECT price_coins, slug, sound_type
    INTO v_price, v_slug, v_type
  FROM public.call_sound_catalog
  WHERE id = p_sound_id AND is_active = true
  LIMIT 1;

  IF v_slug IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'sound_not_found');
  END IF;

  SELECT troll_coins
    INTO v_balance
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;

  IF v_balance < v_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_enough_coins');
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_price,
      total_spent_coins = COALESCE(total_spent_coins, 0) + v_price,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.user_call_sounds (user_id, sound_id, is_active)
  VALUES (p_user_id, p_sound_id, false)
  ON CONFLICT DO NOTHING;

  IF p_set_active THEN
    UPDATE public.user_call_sounds
    SET is_active = false
    WHERE user_id = p_user_id
      AND sound_id IN (
        SELECT id FROM public.call_sound_catalog WHERE sound_type = v_type
      );

    UPDATE public.user_call_sounds
    SET is_active = true
    WHERE user_id = p_user_id AND sound_id = p_sound_id;
  END IF;

  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'coin_transactions' AND column_name = 'amount'
    ) THEN
      EXECUTE
        'INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, now())'
      USING p_user_id, 'call_sound_purchase', v_price,
            format('Call sound purchase: %s', v_slug),
            jsonb_build_object('type','call_sound_purchase','sound_slug',v_slug,'sound_id',p_sound_id);
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'coin_transactions' AND column_name = 'coins'
    ) THEN
      EXECUTE
        'INSERT INTO public.coin_transactions (user_id, type, coins, description, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, now())'
      USING p_user_id, 'call_sound_purchase', v_price,
            format('Call sound purchase: %s', v_slug),
            jsonb_build_object('type','call_sound_purchase','sound_slug',v_slug,'sound_id',p_sound_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'sound_id', p_sound_id,
    'sound_slug', v_slug,
    'price', v_price
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_active_call_sound(
  p_user_id uuid,
  p_sound_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_owned boolean := false;
BEGIN
  SELECT sound_type INTO v_type
  FROM public.call_sound_catalog
  WHERE id = p_sound_id;

  IF v_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'sound_not_found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_call_sounds
    WHERE user_id = p_user_id AND sound_id = p_sound_id
  )
  INTO v_owned;

  IF NOT v_owned THEN
    RETURN jsonb_build_object('success', false, 'error', 'sound_not_owned');
  END IF;

  UPDATE public.user_call_sounds
  SET is_active = false
  WHERE user_id = p_user_id
    AND sound_id IN (
      SELECT id FROM public.call_sound_catalog WHERE sound_type = v_type
    );

  UPDATE public.user_call_sounds
  SET is_active = true
  WHERE user_id = p_user_id AND sound_id = p_sound_id;

  RETURN jsonb_build_object('success', true, 'sound_id', p_sound_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_call_sound(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_active_call_sound(uuid, uuid) TO authenticated;

-- Seed call sounds
INSERT INTO public.call_sound_catalog (slug, name, sound_type, asset_url, price_coins, is_active)
VALUES
  ('classic-ring', 'Classic Ring', 'ringtone', '/sounds/calls/ringtone-classic.mp3', 250, true),
  ('neon-ring', 'Neon Ring', 'ringtone', '/sounds/calls/ringtone-neon.mp3', 400, true),
  ('classic-dial', 'Classic Dial', 'dialtone', '/sounds/calls/dialtone-classic.mp3', 200, true),
  ('neon-dial', 'Neon Dial', 'dialtone', '/sounds/calls/dialtone-neon.mp3', 350, true)
ON CONFLICT (slug) DO NOTHING;
