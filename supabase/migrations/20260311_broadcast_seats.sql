-- Broadcast seat assignments table for Officer Stream
CREATE TABLE IF NOT EXISTS public.broadcast_seats (
  room TEXT NOT NULL,
  seat_index INTEGER NOT NULL CHECK (seat_index BETWEEN 1 AND 6),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  username TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'troll_officer',
  metadata JSONB DEFAULT '{}'::JSONB,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room, seat_index)
);

-- Trigger helper to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.broadcast_seats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_broadcast_seats_updated_at ON public.broadcast_seats;
CREATE TRIGGER set_broadcast_seats_updated_at
BEFORE UPDATE ON public.broadcast_seats
FOR EACH ROW EXECUTE FUNCTION public.broadcast_seats_updated_at();

-- RPC: claim a seat with atomic guard
CREATE OR REPLACE FUNCTION public.claim_broadcast_seat(
  p_room TEXT,
  p_seat_index INTEGER,
  p_user_id UUID,
  p_username TEXT,
  p_avatar_url TEXT,
  p_role TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (
  room TEXT,
  seat_index INTEGER,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  role TEXT,
  metadata JSONB,
  assigned_at TIMESTAMPTZ,
  created BOOLEAN,
  is_owner BOOLEAN
) AS $$
DECLARE
  existing public.broadcast_seats%ROWTYPE;
BEGIN
  LOCK public.broadcast_seats IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO existing
  FROM public.broadcast_seats
  WHERE room = p_room AND seat_index = p_seat_index
  FOR UPDATE;

  IF FOUND THEN
    room := existing.room;
    seat_index := existing.seat_index;
    user_id := existing.user_id;
    username := existing.username;
    avatar_url := existing.avatar_url;
    role := existing.role;
    metadata := existing.metadata;
    assigned_at := existing.assigned_at;
    created := FALSE;
    is_owner := existing.user_id = p_user_id;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.broadcast_seats (
    room, seat_index, user_id, username, avatar_url, role, metadata
  ) VALUES (
    p_room, p_seat_index, p_user_id, p_username, p_avatar_url, p_role, COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING room, seat_index, user_id, username, avatar_url, role, metadata, assigned_at
  INTO room, seat_index, user_id, username, avatar_url, role, metadata, assigned_at;

  created := TRUE;
  is_owner := TRUE;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- RPC: release a seat
CREATE OR REPLACE FUNCTION public.release_broadcast_seat(
  p_room TEXT,
  p_seat_index INTEGER,
  p_user_id UUID,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  room TEXT,
  seat_index INTEGER,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  role TEXT,
  metadata JSONB,
  assigned_at TIMESTAMPTZ
) AS $$
DECLARE
  existing public.broadcast_seats%ROWTYPE;
BEGIN
  SELECT * INTO existing
  FROM public.broadcast_seats
  WHERE room = p_room AND seat_index = p_seat_index
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT p_force AND existing.user_id <> p_user_id THEN
    RETURN;
  END IF;

  DELETE FROM public.broadcast_seats
  WHERE room = p_room AND seat_index = p_seat_index
  RETURNING room, seat_index, user_id, username, avatar_url, role, metadata, assigned_at
  INTO room, seat_index, user_id, username, avatar_url, role, metadata, assigned_at;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
