import 'dotenv/config'
import fs from 'fs'
import { Client } from 'pg'

const sqlPath = './fix_admin_broadcasts_permissions.sql'

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Aborting.')
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
