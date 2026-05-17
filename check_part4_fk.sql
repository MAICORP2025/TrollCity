-- PART 4: CHECK FOREIGN KEY ISSUES
SELECT '=== FK TO NON-EXISTENT TABLES ===' AS check_type;

SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    CASE WHEN ccu.table_name IS NULL THEN 'MISSING!' ELSE 'OK' END AS status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND ccu.table_name IS NULL
ORDER BY tc.table_name
LIMIT 30;