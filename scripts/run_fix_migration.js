import fs from 'fs'
import { Client } from 'pg'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

const sqlPath = './supabase/migrations/20260109_unify_entrance_effects.sql'

async function run() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Aborting.')
    process.exit(1)
  }

  // Convert Supabase URL to PostgreSQL connection string with service role key
  const connectionString = `postgresql://postgres:${supabaseKey}@${supabaseUrl.replace('https://', '')}/postgres`
  const sql = fs.readFileSync(sqlPath, 'utf-8')
  const client = new Client({ connectionString })
  
  try {
    await client.connect()
    console.log('Running migration to fix UUID casting issue...')
    await client.query(sql)
    console.log('Migration completed successfully.')
  } catch (e) {
    console.error('Migration failed:', e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()