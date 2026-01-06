import fs from 'fs'
import { Client } from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load .env
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sqlPath = path.join(__dirname, '../supabase/migrations/20260106_fix_call_minutes_error.sql')

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set in .env. Aborting.')
    process.exit(1)
  }

  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration file not found at: ${sqlPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8')
  const client = new Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    console.log('Running migration...')
    await client.query(sql)
    console.log('Migration completed.')
  } catch (e) {
    console.error('Migration failed:', e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
