-- Fix for "Cannot coerce the result to a single JSON object" error
-- This usually happens if RPC returns SETOF instead of scalar, or if multiple rows are involved

-- 1. Ensure call_minutes has unique user_id and remove duplicates if any
DO $$
BEGIN
  -- Remove duplicates keeping the one with latest updated_at
  DELETE FROM call_minutes a USING (
      SELECT user_id, MAX(updated_at) as max_updated
      FROM call_minutes 
      GROUP BY user_id HAVING COUNT(*) > 1
  ) b
  WHERE a.user_id = b.user_id 
  AND a.updated_at < b.max_updated;
  
  -- Add constraint if missing
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'call_minutes_user_id_key'
  ) THEN
    ALTER TABLE call_minutes ADD CONSTRAINT call_minutes_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 2. Drop and Recreate RPC functions to ensure correct return types (JSONB scalar)

DROP FUNCTION IF EXISTS add_call_minutes(uuid, integer, text);
DROP FUNCTION IF EXISTS deduct_call_minutes(uuid, integer, text);
DROP FUNCTION IF EXISTS get_call_balances(uuid);

-- Recreate add_call_minutes
CREATE OR REPLACE FUNCTION add_call_minutes(
  p_user_id UUID,
  p_minutes INTEGER,
  p_type TEXT -- 'audio' or 'video'
) RETURNS JSONB AS $$
DECLARE
  v_current_audio INTEGER := 0;
  v_current_video INTEGER := 0;
BEGIN
  -- Get current balance (handle no row case)
  SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
  INTO v_current_audio, v_current_video
  FROM call_minutes
  WHERE user_id = p_user_id;

  -- Update or insert
  IF NOT FOUND THEN
    INSERT INTO call_minutes (user_id, audio_minutes, video_minutes, updated_at)
    VALUES (
      p_user_id,
      CASE WHEN p_type = 'audio' THEN p_minutes ELSE 0 END,
      CASE WHEN p_type = 'video' THEN p_minutes ELSE 0 END,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
      audio_minutes = call_minutes.audio_minutes + CASE WHEN p_type = 'audio' THEN p_minutes ELSE 0 END,
      video_minutes = call_minutes.video_minutes + CASE WHEN p_type = 'video' THEN p_minutes ELSE 0 END,
      updated_at = NOW();
      
    -- Re-fetch to be sure
    SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
    INTO v_current_audio, v_current_video
    FROM call_minutes
    WHERE user_id = p_user_id;
  ELSE
    UPDATE call_minutes
    SET 
      audio_minutes = CASE WHEN p_type = 'audio' THEN audio_minutes + p_minutes ELSE audio_minutes END,
      video_minutes = CASE WHEN p_type = 'video' THEN video_minutes + p_minutes ELSE video_minutes END,
      updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING audio_minutes, video_minutes INTO v_current_audio, v_current_video;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'audio_minutes', v_current_audio,
    'video_minutes', v_current_video
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate deduct_call_minutes
CREATE OR REPLACE FUNCTION deduct_call_minutes(
  p_user_id UUID,
  p_minutes INTEGER,
  p_type TEXT -- 'audio' or 'video'
) RETURNS JSONB AS $$
DECLARE
  v_current_audio INTEGER := 0;
  v_current_video INTEGER := 0;
  v_new_audio INTEGER;
  v_new_video INTEGER;
BEGIN
  -- Get current balance
  SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
  INTO v_current_audio, v_current_video
  FROM call_minutes
  WHERE user_id = p_user_id;

  -- Calculate new balances
  IF p_type = 'audio' THEN
    v_new_audio := GREATEST(0, v_current_audio - p_minutes);
    v_new_video := v_current_video;
  ELSE -- video uses 2x minutes
    v_new_audio := v_current_audio;
    v_new_video := GREATEST(0, v_current_video - (p_minutes * 2));
  END IF;

  -- Update balance
  UPDATE call_minutes
  SET 
    audio_minutes = v_new_audio,
    video_minutes = v_new_video,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Handle case where no row existed (shouldn't happen for deduction usually, but good to be safe)
  IF NOT FOUND THEN
    INSERT INTO call_minutes (user_id, audio_minutes, video_minutes)
    VALUES (p_user_id, 0, 0);
    v_new_audio := 0;
    v_new_video := 0;
  END IF;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'has_minutes', CASE WHEN p_type = 'audio' THEN v_new_audio > 0 ELSE v_new_video > 0 END,
    'audio_minutes', v_new_audio,
    'video_minutes', v_new_video
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate get_call_balances
CREATE OR REPLACE FUNCTION get_call_balances(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_audio INTEGER := 0;
  v_video INTEGER := 0;
BEGIN
  SELECT COALESCE(audio_minutes, 0), COALESCE(video_minutes, 0)
  INTO v_audio, v_video
  FROM call_minutes
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'audio_minutes', v_audio,
    'video_minutes', v_video
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
