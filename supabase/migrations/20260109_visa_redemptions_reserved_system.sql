-- Visa eGift Reserved Coins System
-- Enforces tiered Visa redemptions with reserved coins movement
-- Functions: request_visa_redemption, approve_visa_redemption, fulfill_visa_redemption, reject_visa_redemption

BEGIN;

DROP FUNCTION IF EXISTS public.is_staff(uuid);
CREATE OR REPLACE FUNCTION public.is_staff(p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = p_uid
    AND (up.role = 'admin' OR up.role = 'secretary' OR up.is_admin = true)
  );
$$;

CREATE TABLE IF NOT EXISTS public.visa_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id),
  coins_reserved bigint NOT NULL CHECK (coins_reserved > 0),
  usd_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','fulfilled','rejected')),
  giftcard_code text,
  notes text,
  approved_at timestamptz,
  fulfilled_at timestamptz,
  rejected_at timestamptz,
  approved_by uuid REFERENCES public.user_profiles(id),
  fulfilled_by uuid REFERENCES public.user_profiles(id),
  rejected_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visa_redemptions_user ON public.visa_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_visa_redemptions_status ON public.visa_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_visa_redemptions_created ON public.visa_redemptions(created_at);

ALTER TABLE public.visa_redemptions ENABLE ROW LEVEL SECURITY;

COMMIT;

BEGIN;

DROP POLICY IF EXISTS "User can view own redemptions" ON public.visa_redemptions;
CREATE POLICY "User can view own redemptions"
  ON public.visa_redemptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can manage redemptions" ON public.visa_redemptions;
CREATE POLICY "Staff can manage redemptions"
  ON public.visa_redemptions FOR ALL
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE OR REPLACE VIEW public.visa_redemptions_user_view AS
SELECT
  r.id,
  r.user_id,
  r.coins_reserved,
  r.usd_amount,
  r.status,
  CASE WHEN r.status = 'fulfilled' THEN r.giftcard_code ELSE NULL END AS giftcard_code,
  r.created_at,
  r.approved_at,
  r.fulfilled_at,
  r.rejected_at
FROM public.visa_redemptions r;

GRANT SELECT ON public.visa_redemptions_user_view TO authenticated;

DROP FUNCTION IF EXISTS public.request_visa_redemption(uuid, bigint, numeric);
DROP FUNCTION IF EXISTS public.request_visa_redemption(bigint);
DROP FUNCTION IF EXISTS public.request_visa_redemption(uuid, integer, numeric);
CREATE OR REPLACE FUNCTION public.request_visa_redemption(
  p_user_id uuid,
  p_coins bigint,
  p_usd numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reserved bigint;
  v_available bigint;
  v_total bigint;
  v_usd numeric(10,2);
  v_redemption_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  IF p_coins NOT IN (12000, 30000, 60000, 120000) THEN
    RAISE EXCEPTION 'Invalid tier';
  END IF;

  v_usd := CASE p_coins
    WHEN 12000 THEN 25
    WHEN 30000 THEN 70
    WHEN 60000 THEN 150
    WHEN 120000 THEN 325
  END;

  IF p_usd IS NULL OR p_usd::numeric(10,2) <> v_usd THEN
    RAISE EXCEPTION 'USD does not match tier';
  END IF;

  SELECT COALESCE(troll_coins,0), COALESCE(reserved_troll_coins,0)
    INTO v_total, v_reserved
  FROM public.user_profiles
  WHERE id = p_user_id;

  v_available := v_total - v_reserved;
  IF v_available < p_coins THEN
    RAISE EXCEPTION 'Insufficient available coins';
  END IF;

  UPDATE public.user_profiles
  SET reserved_troll_coins = COALESCE(reserved_troll_coins,0) + p_coins,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.visa_redemptions (
    user_id, coins_reserved, usd_amount, status, created_at
  ) VALUES (
    p_user_id, p_coins, v_usd, 'pending', now()
  )
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'redemption_id', v_redemption_id,
    'WalletBefore', jsonb_build_object(
      'available', v_available,
      'reserved', v_reserved
    ),
    'WalletAfter', jsonb_build_object(
      'available', v_available - p_coins,
      'reserved', v_reserved + p_coins
    ),
    'RedemptionStatus', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_visa_redemption(uuid, bigint, numeric) TO authenticated;

DROP FUNCTION IF EXISTS public.approve_visa_redemption(uuid);
CREATE OR REPLACE FUNCTION public.approve_visa_redemption(
  p_redemption_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_role text;
  v_row public.visa_redemptions;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE id = v_admin_id;
  IF v_role NOT IN ('admin','secretary') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_row FROM public.visa_redemptions WHERE id = p_redemption_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;

  IF v_row.status IN ('fulfilled','rejected') THEN
    RAISE EXCEPTION 'Redemption already processed';
  END IF;

  UPDATE public.visa_redemptions
  SET status = 'approved',
      approved_at = now(),
      approved_by = v_admin_id,
      updated_at = now()
  WHERE id = p_redemption_id;

  RETURN jsonb_build_object('success', true, 'RedemptionStatus', 'approved');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_visa_redemption(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.fulfill_visa_redemption(uuid, text);
DROP FUNCTION IF EXISTS public.fulfill_visa_redemption(uuid, text, text);
CREATE OR REPLACE FUNCTION public.fulfill_visa_redemption(
  p_redemption_id uuid,
  p_giftcard_code text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_role text;
  v_row public.visa_redemptions;
  v_reserved bigint;
  v_available_before bigint;
  v_reserved_before bigint;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE id = v_admin_id;
  IF v_role NOT IN ('admin','secretary') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_row FROM public.visa_redemptions WHERE id = p_redemption_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;

  IF v_row.status IN ('fulfilled','rejected') THEN
    RAISE EXCEPTION 'Redemption already processed';
  END IF;

  SELECT COALESCE(troll_coins,0) - COALESCE(reserved_troll_coins,0),
         COALESCE(reserved_troll_coins,0)
    INTO v_available_before, v_reserved_before
  FROM public.user_profiles
  WHERE id = v_row.user_id;

  UPDATE public.user_profiles
  SET troll_coins = GREATEST(0, COALESCE(troll_coins,0) - v_row.coins_reserved),
      reserved_troll_coins = GREATEST(0, COALESCE(reserved_troll_coins,0) - v_row.coins_reserved),
      updated_at = now()
  WHERE id = v_row.user_id;

  UPDATE public.visa_redemptions
  SET status = 'fulfilled',
      giftcard_code = p_giftcard_code,
      fulfilled_at = now(),
      fulfilled_by = v_admin_id,
      updated_at = now()
  WHERE id = p_redemption_id;

  BEGIN
    PERFORM create_notification(
      v_row.user_id,
      'gift_card',
      'Visa eGift Delivered',
      format('You received a %s Visa eGift. Code: %s\nRedemption ID: %s\nFulfilled: %s',
        v_row.usd_amount, p_giftcard_code, p_redemption_id, to_char(now(),'YYYY-MM-DD HH24:MI:SS')),
      jsonb_build_object(
        'usd_amount', v_row.usd_amount,
        'redemption_id', p_redemption_id,
        'fulfilled_at', now()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
    VALUES (
      v_row.user_id,
      'gift_card',
      'Visa eGift Delivered',
      format('You received a %s Visa eGift. Code: %s\nRedemption ID: %s\nFulfilled: %s',
        v_row.usd_amount, p_giftcard_code, p_redemption_id, to_char(now(),'YYYY-MM-DD HH24:MI:SS')),
      jsonb_build_object(
        'usd_amount', v_row.usd_amount,
        'redemption_id', p_redemption_id,
        'fulfilled_at', now()
      ),
      now()
    );
  END;

  RETURN jsonb_build_object(
    'success', true,
    'RedemptionStatus', 'fulfilled',
    'WalletBefore', jsonb_build_object(
      'available', v_available_before,
      'reserved', v_reserved_before
    ),
    'WalletAfter', jsonb_build_object(
      'available', v_available_before,
      'reserved', GREATEST(0, v_reserved_before - v_row.coins_reserved)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fulfill_visa_redemption(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS public.reject_visa_redemption(uuid, text);
CREATE OR REPLACE FUNCTION public.reject_visa_redemption(
  p_redemption_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_role text;
  v_row public.visa_redemptions;
  v_available_before bigint;
  v_reserved_before bigint;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE id = v_admin_id;
  IF v_role NOT IN ('admin','secretary') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_row FROM public.visa_redemptions WHERE id = p_redemption_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;

  IF v_row.status IN ('fulfilled','rejected') THEN
    RAISE EXCEPTION 'Redemption already processed';
  END IF;

  SELECT COALESCE(troll_coins,0) - COALESCE(reserved_troll_coins,0),
         COALESCE(reserved_troll_coins,0)
    INTO v_available_before, v_reserved_before
  FROM public.user_profiles
  WHERE id = v_row.user_id;

  UPDATE public.user_profiles
  SET reserved_troll_coins = GREATEST(0, COALESCE(reserved_troll_coins,0) - v_row.coins_reserved),
      updated_at = now()
  WHERE id = v_row.user_id;

  UPDATE public.visa_redemptions
  SET status = 'rejected',
      rejected_at = now(),
      rejected_by = v_admin_id,
      notes = COALESCE(notes, p_reason),
      updated_at = now()
  WHERE id = p_redemption_id;

  BEGIN
    PERFORM create_notification(
      v_row.user_id,
      'gift_card',
      'Visa Redemption Rejected',
      COALESCE(p_reason, 'Your redemption was rejected. Coins were returned to your wallet.'),
      jsonb_build_object(
        'usd_amount', v_row.usd_amount,
        'redemption_id', p_redemption_id,
        'rejected_at', now()
      )
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO notifications (user_id, type, title, message, metadata, created_at)
    VALUES (
      v_row.user_id,
      'gift_card',
      'Visa Redemption Rejected',
      COALESCE(p_reason, 'Your redemption was rejected. Coins were returned to your wallet.'),
      jsonb_build_object(
        'usd_amount', v_row.usd_amount,
        'redemption_id', p_redemption_id,
        'rejected_at', now()
      ),
      now()
    );
  END;

  RETURN jsonb_build_object(
    'success', true,
    'RedemptionStatus', 'rejected',
    'WalletBefore', jsonb_build_object(
      'available', v_available_before,
      'reserved', v_reserved_before
    ),
    'WalletAfter', jsonb_build_object(
      'available', v_available_before + v_row.coins_reserved,
      'reserved', GREATEST(0, v_reserved_before - v_row.coins_reserved)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_visa_redemption(uuid, text) TO authenticated;

COMMIT;
