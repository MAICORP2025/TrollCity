#!/usr/bin/env node
/**
 * Diagnostic script to check the houses table structure and apply the fix
 * Run: node check_and_fix_houses.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
  console.error('Set these in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkAndFix() {
  try {
    console.log('🔍 Checking houses table structure...\n');

    // Try to query the table to see its structure
    const { data, error } = await supabase
      .from('houses')
      .select('*')
      .limit(1);

    if (error?.message?.includes('does not exist')) {
      console.log('⚠️ Houses table does not exist yet');
      console.log('This is expected if neighborhood_schema.sql hasn\'t been run.\n');
      console.log('✅ To fix:');
      console.log('1. Go to Supabase dashboard');
      console.log('2. Open SQL Editor');
      console.log('3. Copy & paste contents of: supabase/migrations/20260425000001_fix_houses_owner_id_direct.sql');
      console.log('4. Click "Run"\n');
      process.exit(0);
    }

    if (error) {
      console.log('⚠️ Error accessing table:', error.message);
      console.log('\n✅ To fix:');
      console.log('1. Go to Supabase dashboard -> SQL Editor');
      console.log('2. Run this migration:');
      const migrationPath = path.join(__dirname, 'supabase/migrations/20260425000001_fix_houses_owner_id_direct.sql');
      const migration = fs.readFileSync(migrationPath, 'utf8');
      console.log(migration);
      process.exit(0);
    }

    console.log('✅ Houses table exists and is accessible');
    if (data && data.length > 0) {
      console.log('✅ Table has data, structure appears valid');
      console.log('✅ The fix migrations should resolve your issue.\n');
      console.log('Apply the following migration:');
      const migrationPath = path.join(__dirname, 'supabase/migrations/20260425000001_fix_houses_owner_id_direct.sql');
      const migration = fs.readFileSync(migrationPath, 'utf8');
      console.log(migration);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAndFix();
