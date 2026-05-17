-- PART 5: NON-NULLABLE COLUMNS WITHOUT DEFAULTS

SELECT '=== COLUMNS NEEDING DEFAULT ===' AS check_type;

SELECT c.table_name, c.column_name, c.data_type, 'NO DEFAULT' AS status
FROM information_schema.columns c
WHERE c.table_schema = 'public'
AND c.is_nullable = 'NO'
AND c.column_default IS NULL
AND c.table_name IN ('gift_ledger', 'notifications', 'streams')
ORDER BY c.table_name, c.column_name
LIMIT 20;