-- Create table to store promotion tokens for broadcast guests
CREATE TABLE IF NOT EXISTS public.broadcast_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL,
  seat_index integer,
  token text NOT NULL,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  used boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_broadcast_tokens_room ON public.broadcast_tokens(room);
CREATE INDEX IF NOT EXISTS idx_broadcast_tokens_token ON public.broadcast_tokens(token);
