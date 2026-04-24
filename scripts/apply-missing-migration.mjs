import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATION_FILE = path.resolve(__dirname, '../supabase/migrations/20270309000000_add_send_gift_in_stream.sql');

async function run() {
  let databaseUrl = process.env.DATABASE_URL;
  
  // Fallback to default local supabase connection string if not set
  if (!databaseUrl) {
    console.log('DATABASE_URL not set. Using default local Supabase URL.');
    databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  }

  console.log('Connecting to database...');
  const client = new Client({ connectionString: databaseUrl });
  
  try {
    await client.connect();
    console.log('Connected.');
    
    // Set search path
    await client.query('SET search_path TO public, auth, extensions;');

    console.log(`Reading migration: ${MIGRATION_FILE}`);
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');
    
    console.log('Applying migration...');
    await client.query(sql);
    
    console.log('✓ Migration applied successfully!');

    // Verify if function exists
    const res = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'send_gift_in_stream';
    `);

    if (res.rows.length > 0) {
        console.log('✓ Verification: Function send_gift_in_stream exists in database.');
    } else {
        console.error('❌ Verification: Function send_gift_in_stream NOT found after application!');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
