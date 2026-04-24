import 'dotenv/config'
import fs from 'fs'
import { Client } from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const migrationFile = '../supabase/migrations/20270211000007_fix_vehicle_upgrades_type.sql'
const sqlPath = path.resolve(__dirname, migrationFile)

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Aborting.')
    process.exit(1)
  }

  console.log(`Reading migration from: ${sqlPath}`)
  const sql = fs.readFileSync(sqlPath, 'utf-8')
  
  // Use SSL if needed (Supabase usually requires it)
  const client = new Client({ 
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    await client.connect()
    console.log('Connected to database. Running migration...')
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
