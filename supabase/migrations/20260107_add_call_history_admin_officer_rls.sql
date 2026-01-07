-- Allow admins and lead officers to view all call history
DO $$
BEGIN
  ALTER TABLE call_history ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP POLICY IF EXISTS "call_history_admin_view_all" ON call_history;

CREATE POLICY "call_history_admin_view_all"
ON call_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND (
      up.role = 'admin' OR up.is_admin = TRUE
      OR up.role = 'lead_troll_officer' OR up.is_lead_officer = TRUE
    )
  )
);

COMMENT ON POLICY "call_history_admin_view_all" ON call_history IS 'Admins and lead officers can view all calls';
