-- Add private stream password support

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE streams
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS stream_passwords (
  stream_id UUID PRIMARY KEY REFERENCES streams(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stream_passwords ENABLE ROW LEVEL SECURITY;

CREATE POLICY stream_passwords_owner_select
  ON stream_passwords
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_passwords.stream_id
        AND streams.broadcaster_id = auth.uid()
    )
  );

CREATE POLICY stream_passwords_owner_insert_update
  ON stream_passwords
  FOR INSERT, UPDATE, DELETE
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_passwords.stream_id
        AND streams.broadcaster_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_passwords.stream_id
        AND streams.broadcaster_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION set_stream_password(p_stream_id UUID, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM streams
    WHERE id = p_stream_id
      AND broadcaster_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_password IS NULL OR trim(p_password) = '' THEN
    RAISE EXCEPTION 'Private stream password cannot be empty';
  END IF;

  v_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO stream_passwords (stream_id, password_hash, created_at)
  VALUES (p_stream_id, v_hash, NOW())
  ON CONFLICT (stream_id) DO UPDATE
    SET password_hash = v_hash,
        created_at = NOW();

  UPDATE streams
  SET is_private = TRUE
  WHERE id = p_stream_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION verify_stream_password(p_stream_id UUID, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT password_hash INTO v_hash
  FROM stream_passwords
  WHERE stream_id = p_stream_id;

  IF v_hash IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'no_password');
  END IF;

  IF crypt(p_password, v_hash) = v_hash THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
END;
$$;

GRANT EXECUTE ON FUNCTION set_stream_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_stream_password(UUID, TEXT) TO authenticated;
