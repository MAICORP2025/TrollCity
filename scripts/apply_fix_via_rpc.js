import 'dotenv/config'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const sqlPath = './fix_admin_broadcasts_permissions.sql'

async function run() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase env vars')
    process.exit(1)
  }

  console.log('Connecting to Supabase...')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const sql = fs.readFileSync(sqlPath, 'utf-8')
  
  // Try to execute via rpc if a generic sql execution function exists
  // If not, we might need to rely on the user to run it via SQL editor
  // OR we can try to use the REST API if we had a function for it
  
  console.log('Attempting to execute SQL via RPC "exec_sql" or similar if available...')
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
  
  if (error) {
    console.log('RPC exec_sql failed (likely does not exist).')
    console.log('Error:', error.message)
    console.log('\n⚠️  Please run the contents of "fix_admin_broadcasts_permissions.sql" manually in the Supabase SQL Editor.')
  } else {
    console.log('✅ SQL executed successfully via RPC!')
  }
}

run()
