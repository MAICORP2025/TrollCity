-- Grant authenticated access and policies for empire_applications
GRANT SELECT, INSERT, UPDATE ON public.empire_applications TO authenticated;

ALTER TABLE public.empire_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empire_applications_select_own ON public.empire_applications;
DROP POLICY IF EXISTS empire_applications_insert_own ON public.empire_applications;
DROP POLICY IF EXISTS empire_applications_update_own ON public.empire_applications;

CREATE POLICY empire_applications_select_own ON public.empire_applications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY empire_applications_insert_own ON public.empire_applications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY empire_applications_update_own ON public.empire_applications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
