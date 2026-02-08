-- Add guest_price to pod_rooms
ALTER TABLE public.pod_rooms ADD COLUMN IF NOT EXISTS guest_price INTEGER DEFAULT 0;

-- Create pod_whitelists table
CREATE TABLE IF NOT EXISTS public.pod_whitelists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.pod_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(room_id, user_id)
);

-- Enable RLS
ALTER TABLE public.pod_whitelists ENABLE ROW LEVEL SECURITY;

-- Policies for whitelists
-- Host can manage
DROP POLICY IF EXISTS "Hosts can manage whitelist" ON public.pod_whitelists;
CREATE POLICY "Hosts can manage whitelist" ON public.pod_whitelists
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.pod_rooms 
            WHERE id = pod_whitelists.room_id 
            AND host_id = auth.uid()
        )
    );

-- Public read (so users know if they are whitelisted)
DROP POLICY IF EXISTS "Public read whitelist" ON public.pod_whitelists;
CREATE POLICY "Public read whitelist" ON public.pod_whitelists
    FOR SELECT USING (true);

-- RPC for paying to speak
CREATE OR REPLACE FUNCTION public.join_pod_speaker_paid(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room RECORD;
  v_user_balance INT;
  v_price INT;
BEGIN
  -- Get room details
  SELECT * INTO v_room FROM public.pod_rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Room not found'); END IF;

  v_price := COALESCE(v_room.guest_price, 0);

  IF v_price <= 0 THEN
     RETURN json_build_object('success', false, 'error', 'This pod is free to join (use request)');
  END IF;

  -- Check user balance
  SELECT troll_coins INTO v_user_balance FROM public.user_profiles WHERE id = p_user_id;
  
  IF v_user_balance < v_price THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient coins');
  END IF;

  -- Deduct coins
  UPDATE public.user_profiles 
  SET troll_coins = troll_coins - v_price,
      total_spent_coins = COALESCE(total_spent_coins, 0) + v_price
  WHERE id = p_user_id;

  -- Transaction log
  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
  VALUES (p_user_id, -v_price, 'pod_guest_fee', 'Joined Pod Speaker', json_build_object('room_id', p_room_id));

  -- Add/Update participant as speaker
  INSERT INTO public.pod_room_participants (room_id, user_id, role, is_hand_raised)
  VALUES (p_room_id, p_user_id, 'speaker', false)
  ON CONFLICT (room_id, user_id) 
  DO UPDATE SET role = 'speaker', is_hand_raised = false;

  RETURN json_build_object('success', true);
END;
$$;
