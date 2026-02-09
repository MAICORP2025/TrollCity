-- Create battle_participants table
CREATE TABLE IF NOT EXISTS public.battle_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  stream_id UUID REFERENCES public.streams(id), -- The team they are on
  joined_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for battle_participants
ALTER TABLE public.battle_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view battle participants"
ON public.battle_participants FOR SELECT
USING (true);

-- Update accept_battle to include guests
CREATE OR REPLACE FUNCTION public.accept_battle(
  p_battle_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_battle RECORD;
  v_challenger_user_id UUID;
  v_opponent_user_id UUID;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  
  IF v_battle IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  UPDATE public.battles 
  SET status = 'active', started_at = now() 
  WHERE id = p_battle_id;

  -- Link both streams to this battle
  UPDATE public.streams 
  SET battle_id = p_battle_id 
  WHERE id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id);

  -- Get Host User IDs
  SELECT user_id INTO v_challenger_user_id FROM public.streams WHERE id = v_battle.challenger_stream_id;
  SELECT user_id INTO v_opponent_user_id FROM public.streams WHERE id = v_battle.opponent_stream_id;

  -- Insert Hosts as Participants
  INSERT INTO public.battle_participants (battle_id, user_id, stream_id)
  VALUES 
    (p_battle_id, v_challenger_user_id, v_battle.challenger_stream_id),
    (p_battle_id, v_opponent_user_id, v_battle.opponent_stream_id);

  -- Insert Guests (Active Seat Sessions) as Participants
  INSERT INTO public.battle_participants (battle_id, user_id, stream_id)
  SELECT 
    p_battle_id,
    s.user_id,
    s.stream_id
  FROM public.stream_seat_sessions s
  WHERE s.stream_id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id)
  AND s.status = 'active';

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
