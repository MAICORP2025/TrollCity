import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseAnonKey) throw new Error('SUPABASE_ANON_KEY required');

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function reproduceError() {
  const targetId = process.env.TARGET_USER_ID || 'your-user-id'
  console.log(`Fetching profile for: ${targetId}`)

  try {
    const { data, error } = await supabase.from('user_profiles').select('*').eq('id', targetId).maybeSingle()
    if (error) console.error('❌ Error:', error.message)
    else if (data) console.log('✅ Found:', data.username)
    else console.log('⚠️ Not found')
  } catch (err) {
    console.error('❌ Exception:', err)
  }
}

reproduceError()
