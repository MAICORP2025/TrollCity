
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='payout_requests') THEN
    DROP TRIGGER IF EXISTS trg_payout_requests_block_lock ON public.payout_requests;
    CREATE TRIGGER trg_payout_requests_block_lock
    BEFORE INSERT ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.ensure_payout_not_locked();
  END IF;
END$$;
