import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('SUPABASE_URL:', SUPABASE_URL)
console.log('SUPABASE_SERVICE_KEY length:', SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.length : 0)
if (SUPABASE_SERVICE_KEY) {
    console.log('SUPABASE_SERVICE_KEY start:', SUPABASE_SERVICE_KEY.substring(0, 10))
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function apply() {
  try {
    console.log('Testing connection...')
    const { data, error: connError } = await supabase.from('user_profiles').select('count', { count: 'exact', head: true })
    
    if (connError) {
        console.error('❌ Connection failed:', connError)
        return
    }
    console.log('✅ Connection successful. Profiles count:', data)

    const migrationPath = join(__dirname, '../UNIVERSAL_RLS_SYSTEM.sql')
    console.log(`Reading SQL from: ${migrationPath}`)
    const sql = readFileSync(migrationPath, 'utf8')
    
    console.log('🚀 Applying Universal RLS System via RPC...')
    
    // Split by semicolons if needed? 
    // Usually exec_sql handles the whole block if it's designed well. 
    // But sometimes it fails on huge blocks. 
    // However, our script uses DO $$ blocks which contain semicolons.
    // So we should send it as one big string and hope exec_sql uses pg's simple query protocol or similar.
    
    const { error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) {
      console.error('RPC Error:', error)
      console.log('Trying REST fallback...')
      
      const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({ sql })
      })
      
      if (!result.ok) {
          const text = await result.text()
          console.error('REST Error:', text)
          // If the error is about the function not existing, we are stuck.
      } else {
          console.log('✅ Universal RLS System applied successfully via REST')
      }
      
    } else {
      console.log('✅ Universal RLS System applied successfully via RPC')
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

apply()
