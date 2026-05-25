-- RPC Functions for Stream Audience Presence and Seats

-- 1. join_stream_audience - Add user to audience
CREATE OR REPLACE FUNCTION public.join_stream_audience(p_stream_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.stream_audience_presence (
    stream_id, 
    user_id, 
    username, 
    avatar_url
  )
  SELECT 
    p_stream_id,
    auth.uid(),
    up.username,
    up.avatar_url
  FROM public.user_profiles up
  WHERE up.id = auth.uid()
  ON CONFLICT (stream_id, user_id) 
  DO UPDATE SET
    is_active = TRUE,
    left_at = NULL,
    last_seen_at = NOW(),
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. leave_stream_audience - Remove user from audience
CREATE OR REPLACE FUNCTION public.leave_stream_audience(p_stream_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stream_audience_presence
  SET 
    is_active = FALSE,
    left_at = NOW(),
    last_seen_at = NOW()
  WHERE stream_id = p_stream_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. heartbeat_stream_audience - Update last_seen_at to keep presence active
CREATE OR REPLACE FUNCTION public.heartbeat_stream_audience(p_stream_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stream_audience_presence
  SET last_seen_at = NOW()
  WHERE stream_id = p_stream_id
    AND user_id = auth.uid()
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. join_stream_seat - Join a specific seat
CREATE OR REPLACE FUNCTION public.join_stream_seat(
  p_stream_id UUID,
  p_seat_index INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_price INTEGER;
BEGIN
  -- Get seat price from stream data
  SELECT COALESCE(
    (seat_prices ->> p_seat_index)::INTEGER,
    seat_price
  ) INTO v_price
  FROM public.streams
  WHERE id = p_stream_id;

  -- Start a transaction-like approach with optimistic update
  -- First, mark seat as reserved/camera_starting
  UPDATE public.stream_seats
  SET 
    user_id = v_user_id,
    status = 'camera_starting',
    updated_at = NOW()
  WHERE stream_id = p_stream_id
    AND seat_index = p_seat_index
    AND (status = 'empty' OR user_id IS NULL);

  -- Check if we got the seat
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seat already taken or unavailable';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. mark_stream_seat_live - Mark seat as live after camera/mic published
CREATE OR REPLACE FUNCTION public.mark_stream_seat_live(
  p_stream_id UUID,
  p_seat_index INTEGER,
  p_livekit_participant_identity TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stream_seats
  SET 
    status = 'live',
    livekit_participant_identity = COALESCE(p_livekit_participant_identity, livekit_participant_identity),
    updated_at = NOW()
  WHERE stream_id = p_stream_id
    AND seat_index = p_seat_index
    AND status = 'camera_starting';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. leave_stream_seat - Leave current seat
CREATE OR REPLACE FUNCTION public.leave_stream_seat(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stream_seats
  SET 
    user_id = NULL,
    status = 'empty',
    left_at = NOW(),
    updated_at = NOW()
  WHERE id = p_session_id
    AND (status = 'live' OR status = 'camera_starting');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. increment_stream_viewer_gift_total - Add to user's gift total
CREATE OR REPLACE FUNCTION public.increment_stream_viewer_gift_total(
  p_stream_id UUID,
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stream_audience_presence
  SET 
    gift_total = gift_total + p_amount,
    last_seen_at = NOW()
  WHERE stream_id = p_stream_id
    AND user_id = p_user_id
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.join_stream_audience(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_stream_audience(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_stream_audience(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_stream_seat(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_stream_seat_live(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_stream_seat(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_stream_viewer_gift_total(UUID, UUID, INTEGER) TO authenticated;