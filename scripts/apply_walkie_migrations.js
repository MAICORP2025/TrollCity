import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. First apply the Schema
const SCHEMA_MIGRATION = path.resolve(__dirname, '../supabase/migrations/20270212000000_walkie_talkie_system.sql')
// 2. Then apply the Fixes/Triggers
const FIX_MIGRATION = path.resolve(__dirname, '../supabase/migrations/20270327000000_fix_votes_and_walkie.sql')

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

    // Apply Schema
    if (fs.existsSync(SCHEMA_MIGRATION)) {
        console.log(`Reading Schema migration: ${SCHEMA_MIGRATION}`)
        const sqlSchema = fs.readFileSync(SCHEMA_MIGRATION, 'utf-8')
        console.log('Applying Schema migration...')
        await client.query(sqlSchema)
        console.log('Schema Success!')
    } else {
        console.error(`Schema migration file not found: ${SCHEMA_MIGRATION}`)
    }

    // Apply Fixes
    if (fs.existsSync(FIX_MIGRATION)) {
        console.log(`Reading Fix migration: ${FIX_MIGRATION}`)
        const sqlFix = fs.readFileSync(FIX_MIGRATION, 'utf-8')
        console.log('Applying Fix migration...')
        await client.query(sqlFix)
        console.log('Fix Success!')
    } else {
        console.error(`Fix migration file not found: ${FIX_MIGRATION}`)
    }
    
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await client.end()
  }
}

run()
