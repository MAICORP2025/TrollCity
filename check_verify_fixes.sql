-- Verify RLS and defaults applied

-- Check RLS enabled
SELECT '=== TABLES WITH RLS NOW ===' AS check_type;
SELECT t.table_name, 'RLS NOW' AS status
FROM information_schema.tables t
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.tablename = t.table_name 
    AND p.schemaname = 'public'
)
ORDER BY t.table_name
LIMIT 50;

-- Check SECURITY DEFINER views/functions (security risk)
SELECT '=== SECURITY DEFINER OBJECTS ===' AS check_type;
SELECT proname, procost, prosrc
FROM pg_proc
WHERE prosecdef = true
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname
LIMIT 50;

-- Check for v_jail_capacity_summary specifically
SELECT '=== V_JAIL_CAPACITY_SUMMARY SOURCE ===' AS check_type;
SELECT pg_get_viewdef('public.v_jail_capacity_summary'::regclass, true) AS definition
LIMIT 1;

-- Check if any function used by views has SECURITY DEFINER
SELECT '=== FUNCTIONS IN PUBLIC WITH SECDEF ===' AS check_type;
SELECT p.proname, p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true
LIMIT 20;

-- Check columns have defaults
SELECT '=== COLUMNS WITH DEFAULTS ===' AS check_type;
SELECT c.table_name, c.column_name, c.data_type
FROM information_schema.columns c
WHERE c.table_schema = 'public'
AND c.column_default IS NOT NULL
AND c.table_name IN ('gift_ledger', 'notifications', 'streams')
ORDER BY c.table_name, c.column_name
LIMIT 20;