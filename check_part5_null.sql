-- PART 5: CHECK NULL CONSTRAINT ISSUES
SELECT '=== NOT NULL COLUMNS WITHOUT DEFAULT ===' AS check_type;

SELECT 
    c.table_name,
    c.column_name,
    c.data_type
FROM information_schema.columns c
WHERE c.table_schema = 'public'
AND c.is_nullable = 'NO'
AND c.column_default IS NULL
AND c.table_name IN ('user_profiles', 'streams', 'notifications', 'battles', 'gift_ledger')
ORDER BY c.table_name, c.ordinal_position
LIMIT 30;