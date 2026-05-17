import { createClient } from '@supabase/supabase-js'

// ⚠️  IMPORTANT: Use environment variables for production!
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixOrphanedUser() {
  console.log('\n=== FIXING ORPHANED USER ===\n')

  const userId = '8d8b6a4f-d990-495f-8a2b-3de5ee7739c9'
  const username = 'udryve2025'

  const { error } = await supabase
    .from('user_profiles')
    .insert([{
      id: userId,
      username: username,
      avatar_url: '',
      bio: '',
      role: 'user',
      tier: 'Bronze',
      troll_coins: 0,
      total_earned_coins: 0,
      total_spent_coins: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()

  if (error) {
    console.error('❌ Error creating profile:', error)
    return
  }

  console.log('✅ Profile created successfully for udryve2025@gmail.com')
  console.log('   Username: @' + username)
  console.log('   User ID:', userId)
  console.log('\nUser is now registered in the admin dashboard!')
}

fixOrphanedUser().catch(console.error)
