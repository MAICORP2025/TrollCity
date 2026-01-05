
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMjkxMTcsImV4cCI6MjA3OTYwNTExN30.S5Vc1xpZoZ0aemtNFJGcPhL_zvgPA0qgZq8e8KigUx8'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function reproduceError() {
  const targetId = '013a364a-d1df-4693-87bb-a58ef42eb090'
  console.log(`Attempting to fetch profile for ID: ${targetId} using Anon Key...`)

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*, avatar_url')
      .eq('id', targetId)
      .maybeSingle()

    if (error) {
      console.error('❌ Error returned from Supabase:', JSON.stringify(error, null, 2))
    } else if (data) {
      console.log('✅ Success! Data received:', data.username)
    } else {
      console.log('⚠️ No data and no error (Not Found or RLS hidden)')
    }
  } catch (err) {
    console.error('❌ Exception thrown:', err)
  }
}

reproduceError()
