import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

console.log('🚀 Starting migration application...')
console.log(`📍 Supabase URL: ${supabaseUrl}\n`)

const supabase = createClient(supabaseUrl, supabaseKey)

const migrationsDir = './supabase/migrations'
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

console.log(`📁 Found ${files.length} migration files\n`)

let success = 0
let errors = 0

for (const file of files) {
  console.log(`⚙️  Applying: ${file}`)
  
  try {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    
    if (!sql.trim()) {
      console.log(`   ⊘ Skipped (empty)\n`)
      continue
    }

    // Execute via RPC or direct SQL
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql })
    
    if (error) throw error
    
    console.log(`   ✅ Success\n`)
    success++
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}\n`)
    errors++
  }
}

console.log(`\n📊 Summary:`)
console.log(`   Total: ${files.length}`)
console.log(`   ✅ Success: ${success}`)
console.log(`   ❌ Errors: ${errors}`)
