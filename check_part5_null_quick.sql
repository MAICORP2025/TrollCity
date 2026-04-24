-- PART 5: NULL check quick
SELECT 'gift_ledger' AS tbl, column_name FROM information_schema.columns WHERE table_name='gift_ledger' AND is_nullable='NO' AND column_default IS NULL
UNION ALL
SELECT 'notifications', column_name FROM information_schema.columns WHERE table_name='notifications' AND is_nullable='NO' AND column_default IS NULL
UNION ALL
SELECT 'streams', column_name FROM information_schema.columns WHERE table_name='streams' AND is_nullable='NO' AND column_default IS NULL LIMIT 10;