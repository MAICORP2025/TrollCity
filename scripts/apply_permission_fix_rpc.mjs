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

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function apply() {
  try {
    const migrationPath = join(__dirname, '../supabase/migrations/20270304000002_fix_court_fk.sql')
    const sql = readFileSync(migrationPath, 'utf8')
    
    console.log('🚀 Applying migration via RPC...')
    
    const { error } = await supabase.rpc('exec_sql', { sql: sql }) 
    
    if (error) {
      console.error('RPC Error:', error)
      
      // Try 'exec' or 'execute_sql' if 'exec_sql' fails or parameter is different
      const { error: error2 } = await supabase.rpc('exec', { query: sql })
       if (error2) console.error('RPC exec Error:', error2)
       else console.log('✅ Migration applied successfully via exec')

    } else {
      console.log('✅ Migration applied successfully via exec_sql')
    }

  } catch (err) {
    console.error('Script failed:', err)
  }
}

apply()