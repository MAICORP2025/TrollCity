import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const migrationFile = '../supabase/migrations/20250201_universe_event_tables.sql'

async function run() {
  const databaseUrl = process.env.DATABASE_URL || process.env.VITE_SUPABASE_URL // Fallback or check standard env var
  
  // Note: VITE_SUPABASE_URL is usually the API URL, not the Postgres connection string.
  // We strictly need DATABASE_URL (postgres://...) for 'pg' client.
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env file.')
    console.error('Please add DATABASE_URL=postgres://postgres:[password]@[host]:[port]/postgres to your .env file')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  
  try {
    await client.connect()
    console.log('Connected to database.')

    const fullPath = path.resolve(__dirname, migrationFile)
    console.log(`Reading migration: ${migrationFile}`)
    
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`)
      process.exit(1)
    }

    const sql = fs.readFileSync(fullPath, 'utf-8')
    console.log(`Applying migration: ${path.basename(fullPath)}`)
    
    await client.query(sql)
    console.log(`✓ Success: ${path.basename(fullPath)}`)

  } catch (e) {
    console.error('Migration failed:', e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
