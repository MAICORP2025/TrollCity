-- Update coin rate to 0.5 per minute and fix types

-- 0. Drop triggers and views that depend on the columns
DROP VIEW IF EXISTS public.creator_earnings;
DROP VIEW IF EXISTS public.monthly_earnings_breakdown;
DROP TRIGGER IF EXISTS trg_sync_trollstown_coins ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_set_trollstown_coins ON public.trollstown_properties;

-- 1. Change column types to NUMERIC(20,2) to support decimals
ALTER TABLE public.user_profiles ALTER COLUMN troll_coins TYPE NUMERIC(20, 2);
ALTER TABLE public.user_profiles ALTER COLUMN total_earned_coins TYPE NUMERIC(20, 2);
ALTER TABLE public.user_profiles ALTER COLUMN total_spent_coins TYPE NUMERIC(20, 2);

-- Update trollstown_properties troll_coins type
ALTER TABLE public.trollstown_properties ALTER COLUMN troll_coins TYPE NUMERIC(20, 2);

-- 2. Update process_stream_billing to charge 0.5 coins
CREATE OR REPLACE FUNCTION public.process_stream_billing(
  p_stream_id UUID,
  p_user_id UUID,
  p_is_host BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream RECORD;
  v_user_profile RECORD;
  v_cost NUMERIC(20, 2);
  v_guest RECORD;
BEGIN
  -- Check if stream exists and is active
  SELECT * INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id;

  IF NOT FOUND OR v_stream.is_live = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stream not found or not active');
  END IF;

  -- Get user profile
  SELECT * INTO v_user_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- A. Broadcaster Billing (0.5 coins/min)
  IF p_is_host THEN
    -- Check for exempt roles (Admin/Officers don't pay)
    IF v_user_profile.role IN ('admin', 'troll_officer', 'lead_troll_officer', 'secretary') THEN
      v_cost := 0;
    ELSE
      v_cost := 0.5; -- CHANGED FROM 2 TO 0.5
    END IF;

    IF v_cost > 0 THEN
        -- Check balance
        IF v_user_profile.troll_coins < v_cost THEN
           -- End stream if insufficient funds
           UPDATE public.streams
           SET is_live = false, ended_at = NOW()
           WHERE id = p_stream_id;
           
           RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'end_stream');
        END IF;

        -- Deduct coins
        UPDATE public.user_profiles
        SET troll_coins = troll_coins - v_cost,
            total_spent_coins = total_spent_coins + v_cost
        WHERE id = p_user_id;

        -- Record transaction
        INSERT INTO public.coin_transactions (
          user_id,
          amount,
          type,
          description,
          stream_id
        ) VALUES (
          p_user_id,
          -v_cost,
          'stream_cost',
          'Broadcasting fee (1 min)',
          p_stream_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  -- B. Guest Billing (0.5 coins/min)
  -- Check if user is a guest in this stream
  SELECT * INTO v_guest
  FROM public.stream_guests
  WHERE stream_id = p_stream_id AND user_id = p_user_id AND status = 'active';

  IF FOUND THEN
      -- Check for exempt roles
      IF v_user_profile.role IN ('admin', 'troll_officer', 'lead_troll_officer', 'secretary') THEN
        v_cost := 0;
      ELSE
        v_cost := 0.5; -- CHANGED FROM 2 TO 0.5
      END IF;

      IF v_cost > 0 THEN
          IF v_user_profile.troll_coins < v_cost THEN
            -- Remove guest
            UPDATE public.stream_guests
            SET status = 'removed', left_at = NOW()
            WHERE stream_id = p_stream_id AND user_id = p_user_id;
            
            RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds', 'action', 'remove_guest');
          END IF;

          -- Deduct coins
          UPDATE public.user_profiles
          SET troll_coins = troll_coins - v_cost,
              total_spent_coins = total_spent_coins + v_cost
          WHERE id = p_user_id;

          -- Record transaction
          INSERT INTO public.coin_transactions (
            user_id,
            amount,
            type,
            description,
            stream_id
          ) VALUES (
            p_user_id,
            -v_cost,
            'stream_cost',
            'Guest participation fee (1 min)',
            p_stream_id
          );
      END IF;

      RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining', v_user_profile.troll_coins - v_cost);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'User not associated with stream billing');
END;
$$;

-- 3. Recreate triggers
CREATE TRIGGER trg_sync_trollstown_coins
  AFTER UPDATE OF troll_coins ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_trollstown_coins_from_profiles();

CREATE TRIGGER trg_set_trollstown_coins
  BEFORE INSERT ON public.trollstown_properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trollstown_coins_on_insert();

-- 4. Recreate views
CREATE OR REPLACE VIEW "public"."creator_earnings" WITH ("security_invoker"='true') AS
 SELECT "u"."id" AS "user_id",
    "u"."username",
    "u"."total_earned_coins",
    "count"("ct"."id") AS "gift_count",
    "sum"("ct"."coins_awarded") AS "gift_coin_total"
   FROM ("public"."user_profiles" "u"
     LEFT JOIN "public"."coin_transactions" "ct" ON ((("u"."id" = "ct"."user_id") AND ("ct"."source" = 'gift'::"text"))))
  GROUP BY "u"."id", "u"."username", "u"."total_earned_coins";

CREATE OR REPLACE VIEW "public"."monthly_earnings_breakdown" WITH ("security_invoker"='true') AS
 SELECT "p"."id" AS "user_id",
    "p"."username",
    "date_trunc"('month'::"text", "g"."created_at") AS "month",
    "sum"("g"."coins_spent") AS "coins_earned_from_gifts",
    "count"(DISTINCT "g"."gift_id") AS "gift_count",
    "count"(DISTINCT "g"."sender_id") AS "unique_gifters",
    "sum"(
        CASE
            WHEN ("g"."gift_type" = 'paid'::"text") THEN "g"."coins_spent"
            ELSE (0)::bigint
        END) AS "paid_coins_earned",
    "sum"(
        CASE
            WHEN ("g"."gift_type" = 'free'::"text") THEN "g"."coins_spent"
            ELSE (0)::bigint
        END) AS "free_coins_earned"
   FROM ("public"."user_profiles" "p"
     JOIN "public"."gifts" "g" ON (("g"."receiver_id" = "p"."id")))
  WHERE (("p"."is_broadcaster" = true) OR ("p"."total_earned_coins" > 0))
  GROUP BY "p"."id", "p"."username", ("date_trunc"('month'::"text", "g"."created_at"))
  ORDER BY ("date_trunc"('month'::"text", "g"."created_at")) DESC, ("sum"("g"."coins_spent")) DESC;
