-- Verify insurance_options table has been seeded
SELECT 'insurance_options table' as table_name, COUNT(*) as row_count FROM public.insurance_options;
SELECT * FROM public.insurance_options ORDER BY id;

-- Also check if there's any constraint issue
SELECT constraint_name, column_name, referenced_table_name 
FROM information_schema.key_column_usage 
WHERE table_name = 'user_insurances';
