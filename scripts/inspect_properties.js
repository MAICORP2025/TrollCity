
import 'dotenv/config'
import { Client } from 'pg'

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  try {
    await client.connect()
    
    const res = await client.query(`
      SELECT column_name, column_default, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'properties';
    `)
    
    console.table(res.rows)

  } catch (e) {
    console.error('Check failed:', e)
  } finally {
    await client.end()
  }
}

check()
