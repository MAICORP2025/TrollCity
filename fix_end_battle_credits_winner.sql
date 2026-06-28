-- Fix end_battle_guarded to credit winner with battle win, loser with battle loss,
-- AND award/deduct family & agency league points
-- Run this in Supabase SQL Editor

DROP FUNCTION IF EXISTS public.end_battle_guarded(UUID, UUID, INTEGER, INTEGER);

CREATE FUNCTION public.end_battle_guarded(
  p_battle_id UUID,
  p_winner_id UUID DEFAULT NULL,
  p_min_duration_seconds INTEGER DEFAULT 180,
  p_sudden_death_seconds INTEGER DEFAULT 10
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_battle RECORD;
  v_required INTERVAL;
  v_winner_stream_id UUID;
  v_winner_user_id UUID;
  v_loser_user_id UUID;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;

  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not found');
  END IF;

  IF v_battle.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not active');
  END IF;

  IF v_battle.started_at IS NULL OR v_battle.started_at > now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle not started');
  END IF;

  v_required := make_interval(secs => p_min_duration_seconds + p_sudden_death_seconds - 10);

  IF now() < v_battle.started_at + v_required THEN
    RETURN jsonb_build_object('success', false, 'message', 'Battle timer not elapsed');
  END IF;

  IF p_winner_id IS NOT NULL THEN
    v_winner_stream_id := p_winner_id;
  ELSE
    IF v_battle.score_challenger > v_battle.score_opponent THEN
      v_winner_stream_id := v_battle.challenger_stream_id;
    ELSIF v_battle.score_opponent > v_battle.score_challenger THEN
      v_winner_stream_id := v_battle.opponent_stream_id;
    END IF;
  END IF;

  IF v_winner_stream_id IS NOT NULL THEN
    SELECT user_id INTO v_winner_user_id FROM public.streams WHERE id = v_winner_stream_id;

    IF v_winner_stream_id = v_battle.challenger_stream_id THEN
      SELECT user_id INTO v_loser_user_id FROM public.streams WHERE id = v_battle.opponent_stream_id;
    ELSE
      SELECT user_id INTO v_loser_user_id FROM public.streams WHERE id = v_battle.challenger_stream_id;
    END IF;
  END IF;

  UPDATE public.battles
  SET status = 'ended', ended_at = now(), winner_stream_id = v_winner_stream_id
  WHERE id = p_battle_id;

  IF v_winner_user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET battle_wins = COALESCE(battle_wins, 0) + 1
    WHERE id = v_winner_user_id;

    PERFORM public.award_family_battle_points(v_winner_user_id, 1, p_battle_id, 'battle_won');
    PERFORM public.award_agency_battle_points(v_winner_user_id, 1, p_battle_id);
  END IF;

  IF v_loser_user_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET battle_losses = COALESCE(battle_losses, 0) + 1
    WHERE id = v_loser_user_id;

    PERFORM public.award_family_battle_points(v_loser_user_id, -10, p_battle_id, 'battle_lost');
    PERFORM public.award_agency_battle_points(v_loser_user_id, -10, p_battle_id);
  END IF;

  UPDATE public.streams
  SET battle_id = NULL, is_battle = false
  WHERE battle_id = p_battle_id;

  DELETE FROM public.battle_queue WHERE battle_id = p_battle_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_battle_guarded(UUID, UUID, INTEGER, INTEGER) TO authenticated;
