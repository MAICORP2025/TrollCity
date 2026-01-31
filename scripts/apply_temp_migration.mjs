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
    const migrationPath = join(__dirname, '../supabase/migrations/20270211000000_pay_bank_loan.sql')
    const sql = readFileSync(migrationPath, 'utf8')
    
    console.log('🚀 Applying migration via RPC...')
    console.log(`Reading from: ${migrationPath}`)
    
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
          console.error('REST Error:', await result.text())
      } else {
          console.log('✅ Migration applied successfully via REST')
      }
      
    } else {
      console.log('✅ Migration applied successfully via RPC')
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

apply()
