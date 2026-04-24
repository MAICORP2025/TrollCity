CREATE OR REPLACE FUNCTION public.create_atomic_battle_challenge(
  p_challenger_id UUID,
  p_opponent_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenger_stream RECORD;
  v_opponent_stream RECORD;
  v_existing_battle RECORD;
  v_new_battle_id UUID;
BEGIN
  -- Lock the challenger's stream row to prevent concurrent operations
  SELECT * INTO v_challenger_stream FROM public.streams WHERE id = p_challenger_id FOR UPDATE;

  -- Lock the opponent's stream row
  SELECT * INTO v_opponent_stream FROM public.streams WHERE id = p_opponent_id FOR UPDATE;

  -- Check if either party is already in a battle
  IF v_challenger_stream.battle_id IS NOT NULL OR v_opponent_stream.battle_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'One or both broadcasters are already in a battle.');
  END IF;

  -- Check for an existing pending battle between these two users (in either direction)
  SELECT * INTO v_existing_battle FROM public.battles
  WHERE status = 'pending' AND
        ((challenger_stream_id = p_challenger_id AND opponent_stream_id = p_opponent_id) OR
         (challenger_stream_id = p_opponent_id AND opponent_stream_id = p_challenger_id));

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'A challenge already exists between these broadcasters.');
  END IF;

  -- Create the new battle
  INSERT INTO public.battles (challenger_stream_id, opponent_stream_id, status)
  VALUES (p_challenger_id, p_opponent_id, 'pending')
  RETURNING id INTO v_new_battle_id;

  -- Update both streams to link to the new battle
  UPDATE public.streams SET battle_id = v_new_battle_id WHERE id IN (p_challenger_id, p_opponent_id);

  RETURN jsonb_build_object('success', true, 'battle_id', v_new_battle_id);
END;
$$;