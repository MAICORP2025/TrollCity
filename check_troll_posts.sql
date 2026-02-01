-- Check if troll_posts table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'troll_posts'
) as table_exists;

-- Check columns in troll_posts
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'troll_posts'
ORDER BY ordinal_position;

-- Check RLS Policies on troll_posts
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'troll_posts';

-- Check Foreign Key constraints
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'troll_posts';

-- Check if toggle_post_like function exists
SELECT routines.routine_name, parameters.data_type, parameters.ordinal_position
FROM information_schema.routines
LEFT JOIN information_schema.parameters ON routines.specific_name = parameters.specific_name
WHERE routines.routine_schema = 'public' 
  AND routines.routine_name = 'toggle_post_like'
ORDER BY parameters.ordinal_position;

-- Check if gift_post function exists
SELECT routines.routine_name, parameters.data_type, parameters.ordinal_position
FROM information_schema.routines
LEFT JOIN information_schema.parameters ON routines.specific_name = parameters.specific_name
WHERE routines.routine_schema = 'public' 
  AND routines.routine_name = 'gift_post'
ORDER BY parameters.ordinal_position;
