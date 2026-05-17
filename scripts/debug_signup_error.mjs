import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  console.log('--- Checking vehicles_catalog ---')
  const { data: cars, error: carError } = await supabase
    .from('vehicles_catalog')
    .select('id, name, tier, price, slug')
    .ilike('tier', 'starter')
  
  if (carError) console.error('Error:', carError)
  else console.log('Starter cars found:', cars)

  console.log('\n--- Checking handle_user_signup definition ---')
  const { data: funcDef, error: funcError } = await supabase.rpc('exec_sql', {
    sql: `select prosrc from pg_proc where proname = 'handle_user_signup';`
  })
  
  if (funcError) console.error('Error:', funcError)
  else console.log('Function Definition:', funcDef)
}

debug()
