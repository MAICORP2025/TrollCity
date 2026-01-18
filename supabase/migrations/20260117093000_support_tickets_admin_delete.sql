-- Allow admins and secretaries to delete any support tickets (guard if table missing)
DO $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'support_tickets'
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE NOTICE 'support_tickets table missing; skipping policy/trigger setup';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='Admins or secretaries can delete tickets'
  ) THEN
    CREATE POLICY "Admins or secretaries can delete tickets" ON public.support_tickets
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND (up.role IN ('admin','secretary') OR up.is_admin = true)
        )
      );
  END IF;

  ALTER TABLE IF EXISTS public.support_tickets
    ADD COLUMN IF NOT EXISTS closed_at timestamp with time zone;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_support_tickets_closed_at'
  ) THEN
    CREATE TRIGGER trg_support_tickets_closed_at
      BEFORE UPDATE ON public.support_tickets
      FOR EACH ROW
      EXECUTE FUNCTION public.set_closed_at_if_closed();
  END IF;
END $$;

-- When status changes to 'closed', set closed_at if not provided
CREATE OR REPLACE FUNCTION public.set_closed_at_if_closed()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;
  RETURN NEW;
END; $$;
