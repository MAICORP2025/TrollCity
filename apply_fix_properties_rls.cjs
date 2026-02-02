const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const migrationSQL = `
-- Fix RLS policies for properties table
-- Allow users to insert their own properties (e.g. starter home)
-- Fix potential issue with UPDATE policy referencing wrong column name

DO $$
BEGIN
  -- Enable RLS (idempotent)
  ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

  -- Drop incorrect policies if they exist
  DROP POLICY IF EXISTS "Owners update properties" ON public.properties;
  DROP POLICY IF EXISTS "Users can insert own properties" ON public.properties;
  
  -- Create "Owners update properties" policy
  CREATE POLICY "Owners update properties"
  ON public.properties
  FOR UPDATE
  USING (auth.uid() = owner_user_id);

  -- Create "Users can insert own properties" policy
  CREATE POLICY "Users can insert own properties"
  ON public.properties
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

  -- Ensure "Public read properties" policy exists
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'properties' AND policyname = 'Public read properties'
  ) THEN
      CREATE POLICY "Public read properties" ON public.properties FOR SELECT USING (true);
  END IF;
END $$;
`;

async function runMigration() {
  try {
    console.log('Running migration to fix properties RLS policies...');
    
    // Execute the migration SQL
    const { error } = await supabase.rpc('execute_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration failed:', error);
      return;
    }
    
    console.log('✓ Migration completed successfully!');
    console.log('RLS policies for "properties" table have been updated.');
    
  } catch (error) {
    console.error('Error running migration:', error);
  }
}

runMigration();
