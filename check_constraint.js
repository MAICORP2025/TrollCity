
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkConstraint() {
  console.log('Checking officer_time_off_requests constraints...')
  
  // We can't easily query information_schema via JS client with RLS often, 
  // but we can try to insert a dummy row with a known invalid status to trigger the error 
  // and hopefully see the constraint details in the error message, 
  // or try to find the definition in a different way.
  
  // Actually, let's try to just read the table definition if we can, 
  // but simpler is to check what values are currently in there.
  
  const { data, error } = await supabase
    .from('officer_time_off_requests')
    .select('status')
    .limit(10)
    
  if (error) {
    console.error('Error selecting:', error)
  } else {
    console.log('Existing statuses:', [...new Set(data.map(d => d.status))])
  }
}

checkConstraint()
