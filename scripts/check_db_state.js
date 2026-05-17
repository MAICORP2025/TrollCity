
import 'dotenv/config'
import { Client } from 'pg'

async function check() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  try {
    await client.connect()
    
    // Check if pod_rooms exists
    const res = await client.query("SELECT to_regclass('public.pod_rooms');")
    const exists = res.rows[0].to_regclass !== null
    console.log(`pod_rooms table exists: ${exists}`)
    
    if (!exists) {
        console.log("Tables missing. Need to run migration.")
    } else {
        console.log("Tables exist.")
    }

  } catch (e) {
    console.error('Check failed:', e)
  } finally {
    await client.end()
  }
}

check()
