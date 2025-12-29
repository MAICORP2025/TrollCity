-- Function to get current court session
CREATE OR REPLACE FUNCTION get_current_court_session()
RETURNS TABLE (
    id UUID,
    status court_status_enum,
    started_by UUID,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cs.id,
        cs.status,
        cs.started_by,
        cs.started_at,
        cs.ended_at
    FROM court_sessions cs
    WHERE cs.status IN ('waiting', 'live')
    ORDER BY cs.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;