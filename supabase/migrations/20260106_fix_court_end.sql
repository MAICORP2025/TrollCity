-- Improved end_court_session RPC that also cleans up docket
CREATE OR REPLACE FUNCTION end_court_session(p_session_id TEXT)
RETURNS void AS $$
BEGIN
  -- Update session
  UPDATE court_sessions
  SET status = 'ended', ended_at = NOW()
  WHERE id = p_session_id::uuid;

  -- Update related docket items
  UPDATE court_docket
  SET status = 'processed', updated_at = NOW()
  WHERE court_session_id = p_session_id::uuid AND status = 'in_session';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New function to force end ALL active sessions (for admin dashboard)
CREATE OR REPLACE FUNCTION force_end_all_court_sessions()
RETURNS void AS $$
BEGIN
  -- End all active sessions
  UPDATE court_sessions
  SET status = 'ended', ended_at = NOW()
  WHERE status IN ('live', 'active', 'waiting');

  -- Update docket items
  UPDATE court_docket
  SET status = 'processed', updated_at = NOW()
  WHERE status = 'in_session';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
