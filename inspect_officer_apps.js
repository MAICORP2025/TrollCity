
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function inspectTable() {
  console.log('Inspecting officer_applications table...')
  
  // Try to insert a dummy row to get column error, or just select * limit 1
  const { data, error } = await supabase
    .from('officer_applications')
    .select('*')
    .limit(1)

  if (error) {
    console.error('Error selecting:', error)
  } else {
    console.log('Data sample:', data)
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]))
    } else {
      console.log('Table is empty, cannot infer columns from data.')
    }
  }
}

inspectTable()
