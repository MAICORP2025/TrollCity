
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY // or SERVICE_ROLE if available

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectTable() {
  console.log('Inspecting app_settings table...')
  
  // Try to select one row to see structure if possible (might be blocked by RLS)
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error selecting:', error)
  } else {
    console.log('Sample row:', data)
  }
}

inspectTable()
