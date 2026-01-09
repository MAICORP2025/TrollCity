-- Create unambiguous RPC for deducting troll_coins
CREATE OR REPLACE FUNCTION rpc_deduct_troll_coins(
  p_user_id uuid,
  p_amount bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM deduct_coins(p_user_id => p_user_id, p_amount => p_amount, p_coin_type => 'troll_coins');
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_deduct_troll_coins(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_deduct_troll_coins(uuid, bigint) TO service_role;

