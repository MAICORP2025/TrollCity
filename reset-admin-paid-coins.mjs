import { createClient } from '@supabase/supabase-js'

// ⚠️  IMPORTANT: Use environment variables for production!
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function resetAdmintroll_coins() {
  console.log('\n=== RESETTING ADMIN troll_coins ===\n')

  const { data: admin, error: fetchError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('role', 'admin')
    .single()

  if (fetchError || !admin) {
    console.error('❌ Error fetching admin:', fetchError)
    return
  }

  console.log('Current Admin Balance:')
  console.log(`  Username: ${admin.username}`)
  console.log(`  troll_coins: ${admin.troll_coins}`)

  const { data: updated, error: updateError } = await supabase
    .from('user_profiles')
    .update({ troll_coins: 0 })
    .eq('role', 'admin')
    .select()
    .single()

  if (updateError) {
    console.error('\n❌ Error updating admin:', updateError)
    return
  }

  console.log('\n✅ Admin troll_coins reset successfully!')
  console.log(`  New Balance: ${updated.troll_coins}`)
}

resetAdmintroll_coins().catch(console.error)
