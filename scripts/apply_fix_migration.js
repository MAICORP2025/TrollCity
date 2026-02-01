
import 'dotenv/config'
import { Client } from 'pg'
import fs from 'fs'
import path from 'path'

async function applyMigration() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  
  try {
    await client.connect()
    
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20270215060000_fix_pod_relations.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Applying migration...')
    await client.query(sql)
    console.log('Migration applied successfully!')
    
  } catch (e) {
    console.error('Migration failed:', e)
  } finally {
    await client.end()
  }
}

applyMigration()
