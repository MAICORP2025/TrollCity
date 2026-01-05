import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load env vars
dotenv.config({ path: join(__dirname, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY 

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const targetId = '8dff9f37-21b5-4b8e-adc2-b9286874be1a'

async function checkUser() {
  console.log(`Checking for user ID: ${targetId}`)

  // Check user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', targetId)
    .single()

  if (profileError) {
    console.log('Error finding profile:', profileError.message)
  } else if (profile) {
    console.log('Found in user_profiles:', profile.username)
  } else {
    console.log('Not found in user_profiles')
  }

  // Check streams
  const { data: streams, error: streamsError } = await supabase
    .from('streams')
    .select('*')
    .eq('user_id', targetId)
  
  if (streamsError) {
    console.log('Error checking streams:', streamsError.message)
  } else if (streams && streams.length > 0) {
    console.log(`Found ${streams.length} streams for this user`)
    console.log('Stream data:', JSON.stringify(streams[0], null, 2))
  } else {
    console.log('No streams found for this user')
  }
}

checkUser()
