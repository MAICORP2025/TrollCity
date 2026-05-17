-- Revert Script: Disable RLS and Drop Policies
-- This will restore the database to its state before RLS was enabled.

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
        
        -- 1. Disable RLS (Restores full access immediately)
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
        RAISE NOTICE 'Disabled RLS on %', t;

        -- 2. Clean up Policies (Remove the ones we created)
        EXECUTE format('DROP POLICY IF EXISTS "Public Read" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Owner Write" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Owner Update" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Owner Delete" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Owner Access" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Service Role Bypass" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Admin Bypass" ON public.%I', t);

    END LOOP;
END $$;
