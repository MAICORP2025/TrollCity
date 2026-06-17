-- ============================================================
-- CRITICAL: Fix SECURITY DEFINER RPC functions that lack authorization
-- These functions were GRANTED to authenticated users with NO server-side
-- role checks, allowing any logged-in user to escalate privileges,
-- mint coins, and drain accounts.
-- ============================================================

-- ============================================================
-- 1. Revoke execute from authenticated on dangerous functions
--    These should only be callable by service_role or edge functions
-- ============================================================

-- Coin minting/credit functions
REVOKE EXECUTE ON FUNCTION troll_bank_credit_coins(uuid, integer, text, text, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION troll_bank_credit_coins(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION add_troll_coins(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION add_free_coins(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION credit_coins(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_grant_coins(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION process_boosted_gift(uuid, uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION apply_troll_pass_bundle(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION process_stream_billing(uuid) FROM authenticated;

-- Coin spending/draining functions
REVOKE EXECUTE ON FUNCTION troll_bank_spend_coins(uuid, integer, text, text, text, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION troll_bank_spend_coins(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION try_pay_coins(uuid, uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION spend_coins(uuid, uuid, integer, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION send_gift_v2(uuid, uuid, integer, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION process_gift_with_lucky(uuid, uuid, integer) FROM authenticated;

-- Role manipulation functions
REVOKE EXECUTE ON FUNCTION set_user_role(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION remove_broadofficer(uuid) FROM authenticated;

-- Order approval
REVOKE EXECUTE ON FUNCTION approve_manual_order(uuid) FROM authenticated;

-- Keep service_role access for all (edge functions use this)
GRANT EXECUTE ON FUNCTION troll_bank_credit_coins(uuid, integer, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION troll_bank_credit_coins(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION add_troll_coins(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION add_free_coins(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION credit_coins(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION admin_grant_coins(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION process_boosted_gift(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION apply_troll_pass_bundle(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION process_stream_billing(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION troll_bank_spend_coins(uuid, integer, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION troll_bank_spend_coins(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION try_pay_coins(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION spend_coins(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION send_gift_v2(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION process_gift_with_lucky(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION set_user_role(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION remove_broadofficer(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION approve_manual_order(uuid) TO service_role;

-- ============================================================
-- 2. Fix search_path on troll_bank_credit_coins (was empty string)
-- ============================================================

-- Find and fix any version of troll_bank_credit_coins with empty search_path
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
    FROM pg_proc
    WHERE proname = 'troll_bank_credit_coins'
    AND pronamespace = 'public'::regnamespace
  LOOP
    -- Recreate with proper search_path
    EXECUTE format(
      'ALTER FUNCTION public.troll_bank_credit_coins(%s) SET search_path = public',
      func_record.args
    );
    RAISE NOTICE 'Fixed search_path for troll_bank_credit_coins(%)', func_record.args;
  END LOOP;
END $$;

-- ============================================================
-- 3. Add search_path to key functions that are missing it
-- ============================================================

-- Fix common SECURITY DEFINER functions that may be missing search_path
DO $$
DECLARE
  func_record RECORD;
  target_funcs TEXT[] := ARRAY[
    'troll_bank_spend_coins',
    'try_pay_coins',
    'spend_coins',
    'send_gift_v2',
    'process_gift_with_lucky',
    'approve_manual_order',
    'set_user_role',
    'remove_broadofficer',
    'process_boosted_gift',
    'apply_troll_pass_bundle',
    'process_stream_billing'
  ];
  func_name TEXT;
BEGIN
  FOREACH func_name IN ARRAY target_funcs
  LOOP
    FOR func_record IN
      SELECT oid, proname, pg_get_function_identity_arguments(oid) as args
      FROM pg_proc
      WHERE proname = func_name
      AND pronamespace = 'public'::regnamespace
    LOOP
      BEGIN
        EXECUTE format(
          'ALTER FUNCTION public.%I(%s) SET search_path = public',
          func_record.proname,
          func_record.args
        );
        RAISE NOTICE 'Set search_path = public for %(%)', func_record.proname, func_record.args;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter %(%) — %', func_record.proname, func_record.args, SQLERRM;
      END;
    END LOOP;
  END LOOP;
END $$;
