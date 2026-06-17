-- ============================================================
-- FIX: Profile frame column types
-- Run this if you get "invalid input syntax for type uuid" errors
-- This alters the frame_id column from uuid to text
-- ============================================================

-- Fix user_profile_frames.frame_id: change from uuid to text
DO $$
BEGIN
  -- Check if the column exists and is uuid type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profile_frames'
      AND column_name = 'frame_id'
      AND data_type = 'uuid'
  ) THEN
    -- Drop the foreign key constraint first (if exists)
    ALTER TABLE public.user_profile_frames
      DROP CONSTRAINT IF EXISTS user_profile_frames_frame_id_fkey;

    -- Alter the column type
    ALTER TABLE public.user_profile_frames
      ALTER COLUMN frame_id TYPE text;

    -- Re-add the foreign key constraint
    ALTER TABLE public.user_profile_frames
      ADD CONSTRAINT user_profile_frames_frame_id_fkey
      FOREIGN KEY (frame_id) REFERENCES public.profile_frames(id) ON DELETE CASCADE;

    RAISE NOTICE 'Fixed user_profile_frames.frame_id: uuid -> text';
  ELSE
    RAISE NOTICE 'user_profile_frames.frame_id is already text type, no change needed';
  END IF;
END $$;

-- Also ensure profile_frames.id is text (in case it was created as uuid)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profile_frames'
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.profile_frames
      ALTER COLUMN id TYPE text;
    RAISE NOTICE 'Fixed profile_frames.id: uuid -> text';
  ELSE
    RAISE NOTICE 'profile_frames.id is already text type, no change needed';
  END IF;
END $$;
