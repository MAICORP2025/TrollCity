import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
const envFallbackPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else if (fs.existsSync(envFallbackPath)) {
    dotenv.config({ path: envFallbackPath });
}

const migrationFilePath = process.argv[2];
if (!migrationFilePath) {
    console.error('Please provide a migration file path.');
    process.exit(1);
}

const fullPath = path.resolve(process.cwd(), migrationFilePath);

async function run() {
  let databaseUrl = process.env.DATABASE_URL;
  
  // Fallback to default local supabase connection string if not set
  if (!databaseUrl) {
    console.log('DATABASE_URL not set. Using default local Supabase URL.');
    // Default Supabase local DB
    databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  }

  console.log('Connecting to database...');
  const client = new pg.Client({ connectionString: databaseUrl });
  
  try {
    await client.connect();
    console.log('Connected.');
    
    await client.query('SET search_path TO public, auth, extensions;');

    console.log(`Reading migration: ${fullPath}`);
    const sql = fs.readFileSync(fullPath, 'utf-8');
    
    console.log('Applying migration...');
    await client.query(sql);
    
    console.log('✓ Migration applied successfully!');

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
