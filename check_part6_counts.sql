-- Count tables in DB
SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';

-- Count functions
SELECT count(*) as function_count FROM pg_proc WHERE pronamespace = 'public'::regnamespace;