BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'streams_participants'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'streams_participants' AND column_name = 'is_moderator'
    ) THEN
      ALTER TABLE public.streams_participants
      ADD COLUMN is_moderator BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'streams_participants' AND column_name = 'can_chat'
    ) THEN
      ALTER TABLE public.streams_participants
      ADD COLUMN can_chat BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'streams_participants' AND column_name = 'chat_mute_until'
    ) THEN
      ALTER TABLE public.streams_participants
      ADD COLUMN chat_mute_until TIMESTAMPTZ NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_streams_participants_is_moderator
  ON public.streams_participants(stream_id, is_moderator)
  WHERE is_moderator = TRUE;

CREATE INDEX IF NOT EXISTS idx_streams_participants_chat_mute
  ON public.streams_participants(stream_id, user_id, chat_mute_until)
  WHERE chat_mute_until IS NOT NULL;

COMMIT;
