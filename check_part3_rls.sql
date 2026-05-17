-- PART 3: CHECK TABLES WITHOUT RLS
SELECT '=== TABLES WITHOUT RLS ===' AS check_type;

SELECT t.table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND NOT EXISTS (
    SELECT 1 FROM pg_policies p 
    WHERE p.tablename = t.table_name 
    AND p.schemaname = 'public'
)
AND t.table_name NOT IN ('spatial_ref_sys', 'topology', 'tiger', 'tiger_data')
ORDER BY t.table_name
LIMIT 50;