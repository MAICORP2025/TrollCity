
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY // Service role key would be better for inspection, but anon might work if RLS allows reading schema info or if we use RPC.

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  console.log('Checking court_cases columns...')
  
  // We can try to infer columns by selecting * limit 1
  const { data: rows, error } = await supabase
    .from('court_cases')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error selecting court_cases:', error)
  } else {
    if (rows && rows.length > 0) {
      console.log('Columns found:', Object.keys(rows[0]))
    } else {
      console.log('No rows found, cannot infer columns easily via JS client without admin.')
    }
  }

  // Check valid statuses by inserting dummy if possible, or just guessing.
  // Actually, let's try to call the RPC that is failing to see if we can reproduce or get more info.
  // But we need valid UUIDs.
  
  console.log('Checking RPC create_court_case...')
  // We can't see RPC source code via client easily.
  
  // Let's try to find if there are any rows with status 'inactive'
  const { data: inactiveRows, error: inactiveError } = await supabase
    .from('court_cases')
    .select('id, status')
    .eq('status', 'inactive')
    .limit(5)
    
  if (inactiveError) {
    console.log('Error querying inactive status:', inactiveError.message)
  } else {
    console.log('Found rows with status=inactive:', inactiveRows?.length)
  }
}

checkSchema()
