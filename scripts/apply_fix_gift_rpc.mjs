
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

async function run() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase env vars')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const sql = `
    ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
    ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS coins_value INTEGER DEFAULT 0;
    ALTER TABLE gift_ledger ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
  `
  
  console.log('Attempting to execute SQL via RPC "exec_sql"...')
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql })
  
  if (error) {
    console.log('RPC exec_sql failed.')
    console.log('Error:', error.message)
    
    // Try another common name 'run_sql'
    console.log('Trying "run_sql"...')
    const { error: error2 } = await supabase.rpc('run_sql', { sql })
    if (error2) {
         console.log('RPC run_sql failed:', error2.message)
    } else {
        console.log('✅ SQL executed successfully via RPC run_sql!')
        process.exit(0)
    }
    
    // Try 'exec'
    console.log('Trying "exec"...')
    const { error: error3 } = await supabase.rpc('exec', { query: sql })
    if (error3) {
         console.log('RPC exec failed:', error3.message)
    } else {
        console.log('✅ SQL executed successfully via RPC exec!')
        process.exit(0)
    }

  } else {
    console.log('✅ SQL executed successfully via RPC exec_sql!')
  }
}

run()
