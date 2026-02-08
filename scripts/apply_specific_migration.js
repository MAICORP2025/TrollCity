import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MIGRATION_FILE = path.resolve(__dirname, '../supabase/migrations/20270327000000_fix_votes_and_walkie.sql')

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Aborting.')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  
  try {
    await client.connect()
    console.log('Connected to database.')

    console.log(`Reading migration: ${MIGRATION_FILE}`)
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8')
    
    console.log('Applying migration...')
    await client.query(sql)
    console.log('Success!')
    
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await client.end()
  }
}

run()
