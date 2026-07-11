-- Migration: MaiTalent promo tab support
-- Adds RPC to fetch user promo cards and ensures RLS policies exist

CREATE OR REPLACE FUNCTION public.get_user_promo_cards(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  id uuid,
  code text,
  token_amount numeric,
  source_type text,
  issued_at timestamptz,
  expires_at timestamptz,
  redeemed_at timestamptz,
  status text,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    id, code, token_amount, source_type, issued_at, expires_at,
    redeemed_at, status, metadata, created_at, updated_at
  FROM public.promo_cards
  WHERE user_id = p_user_id
  ORDER BY issued_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_promo_cards(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'promo_cards'
      AND policyname = 'promo_cards_user_own'
  ) THEN
    CREATE POLICY "promo_cards_user_own"
      ON public.promo_cards
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'promo_card_redemptions'
      AND policyname = 'promo_card_redemptions_user_own'
  ) THEN
    CREATE POLICY "promo_card_redemptions_user_own"
      ON public.promo_card_redemptions
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.promo_cards
          WHERE id = promo_card_redemptions.promo_card_id
            AND user_id = auth.uid()
        )
      );
  END IF;
END
$$;
