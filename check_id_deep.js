import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const targetId = '8dff9f37-21b5-4b8e-adc2-b9286874be1a'

async function checkId() {
  console.log(`Checking for ID: ${targetId}`)

  // 1. Check public.user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', targetId)
    .single()
  
  if (profile) {
    console.log('FOUND in public.user_profiles:', profile)
  } else {
    console.log('NOT FOUND in public.user_profiles')
    if (profileError && profileError.code !== 'PGRST116') console.error(profileError)
  }

  // 2. Check auth.users (requires service role key usually, but we'll try)
  // Note: Client libraries often can't access auth.users directly unless using service role
  // We'll try to use rpc if available, or just skip if we can't.
  // Actually, we can check if it's in other tables that reference auth.users
  
  // 3. Check public.streams
  const { data: streams } = await supabase
    .from('streams')
    .select('*')
    .eq('user_id', targetId)
  
  if (streams && streams.length > 0) {
    console.log(`FOUND in public.streams (${streams.length} records):`, streams)
  } else {
    console.log('NOT FOUND in public.streams')
  }

   // 4. Check user_follows (as follower)
   const { data: following } = await supabase
   .from('user_follows')
   .select('*')
   .eq('follower_id', targetId)
 
 if (following && following.length > 0) {
   console.log(`FOUND in user_follows as follower (${following.length} records)`)
 } else {
   console.log('NOT FOUND in user_follows as follower')
 }

    // 5. Check user_follows (as following)
    const { data: followers } = await supabase
    .from('user_follows')
    .select('*')
    .eq('following_id', targetId)
  
  if (followers && followers.length > 0) {
    console.log(`FOUND in user_follows as following (${followers.length} records)`)
  } else {
    console.log('NOT FOUND in user_follows as following')
  }

  // 6. Check troll_wall_posts
  const { data: posts, error: postsError } = await supabase
    .from('troll_wall_posts')
    .select('*')
    .eq('user_id', targetId)

  if (postsError) {
    console.error('Error checking troll_wall_posts:', postsError)
  } else if (posts && posts.length > 0) {
    console.log(`FOUND in troll_wall_posts (${posts.length} records)`)
  } else {
    console.log('NOT FOUND in troll_wall_posts')
  }

  // 7. Check notifications
  const { data: notifications, error: notificationsError } = await supabase
    .from('notifications')
    .select('*')
    .eq('sender_id', targetId)

  if (notificationsError) {
    console.error('Error checking notifications:', notificationsError)
  } else if (notifications && notifications.length > 0) {
    console.log(`FOUND in notifications as sender (${notifications.length} records)`)
  } else {
    console.log('NOT FOUND in notifications as sender')
  }
}

checkId()
