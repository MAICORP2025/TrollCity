
SELECT 
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'admin_update_setting';
