import 'dotenv/config'
import fs from 'fs'
import { Client } from 'pg'
import path from 'path'

const migrations = [
  './supabase/migrations/20270121000000_fix_officer_sessions_and_court_rpc.sql',
  './supabase/migrations/20270121000001_inventory_expiry.sql'
]

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Please ensure .env file exists and contains DATABASE_URL.')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  
  try {
    await client.connect()
    console.log('Connected to database.')

    for (const migrationPath of migrations) {
      console.log(`Applying migration: ${migrationPath}`)
      const absolutePath = path.resolve(migrationPath)
      
      if (!fs.existsSync(absolutePath)) {
        console.error(`Migration file not found: ${absolutePath}`)
        continue
      }

      const sql = fs.readFileSync(absolutePath, 'utf-8')
      await client.query(sql)
      console.log(`Successfully applied: ${migrationPath}`)
    }
    
    console.log('All migrations completed.')
  } catch (e) {
    console.error('Migration failed:', e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
