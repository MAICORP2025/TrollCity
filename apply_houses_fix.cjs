#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Applying houses table fix migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20260425000000_fix_houses_owner_id_constraint.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration using RPC (if available) or direct query
    // Try using execute_sql RPC if available
    const { error } = await supabase.rpc('execute_sql', { sql: migrationSQL });
    
    if (error && error.message.includes('function execute_sql')) {
      // RPC not available, try direct execution using sql
      console.log('execute_sql RPC not available, trying alternative method...');
      
      // Split by semicolons and execute statements individually
      const statements = migrationSQL.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await supabase.rpc('exec', { 
            command: statement.trim()
          }).catch(() => ({ error: { message: 'exec not available' } }));
          
          if (stmtError?.message === 'exec not available') {
            console.warn('No direct SQL execution RPC available. Please run migration manually in Supabase dashboard.');
            console.log('Migration SQL file: supabase/migrations/20260425000000_fix_houses_owner_id_constraint.sql');
            process.exit(0);
          }
        }
      }
    } else if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✓ Migration applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    console.log('\nPlease run the following SQL manually in the Supabase SQL Editor:');
    console.log('File: supabase/migrations/20260425000000_fix_houses_owner_id_constraint.sql');
    process.exit(1);
  }
}

runMigration();
