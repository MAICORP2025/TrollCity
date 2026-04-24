import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://bzwlrvzpyqsqpxhufnpx.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setLevelTo32() {
  try {
    console.log('🔄 Setting level to 32...\n')

    // Get current user from auth
    const { data: { user }, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error getting users:', authError.message)
      return
    }

    // Find the most recently created/updated user (likely the current user)
    // Or you can pass in a specific user ID
    const userId = process.argv[2]
    
    if (!userId) {
      console.log('📋 Available users:')
      user.forEach(u => {
        console.log(`   ${u.id} - ${u.email}`)
      })
      console.log('\n💡 Usage: node set-level-32.mjs <user-id>')
      return
    }

    console.log(`👤 Setting level for user: ${userId}\n`)

    // Fetch current level data
    const { data: currentLevel, error: fetchError } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (fetchError) {
      console.error('❌ Error fetching current level:', fetchError.message)
      return
    }

    if (!currentLevel) {
      console.error('❌ No level record found for user')
      return
    }

    console.log('📊 Current level data:')
    console.log(`   Level: ${currentLevel.level}`)
    console.log(`   XP: ${currentLevel.xp}`)
    console.log(`   Total XP: ${currentLevel.total_xp}\n`)

    // Calculate XP for level 32
    // Assuming level progression: each level requires 100 * level XP
    // Total XP for level 32 = sum of 100*1 + 100*2 + ... + 100*31 = 100 * (31*32/2) = 100 * 496 = 49,600
    // XP for current level 32 = 100 * 32 = 3,200
    const xpPerLevel = (level) => 100 * level
    const totalXpForLevel = (level) => {
      let total = 0
      for (let i = 1; i < level; i++) {
        total += xpPerLevel(i)
      }
      return total
    }

    const level = 32
    const nextLevelXp = xpPerLevel(level)
    const totalXp = totalXpForLevel(level) + nextLevelXp
    const xp = nextLevelXp // Start at beginning of level 32

    // Update the user_levels table
    const { data: updated, error: updateError } = await supabase
      .from('user_levels')
      .update({
        level,
        xp,
        total_xp: totalXp,
        next_level_xp: xpPerLevel(level + 1),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()

    if (updateError) {
      console.error('❌ Error updating level:', updateError.message)
      return
    }

    console.log('✅ Level updated successfully!\n')
    console.log('📊 New level data:')
    console.log(`   Level: ${updated[0].level}`)
    console.log(`   XP: ${updated[0].xp}`)
    console.log(`   Total XP: ${updated[0].total_xp}`)
    console.log(`   Next Level XP: ${updated[0].next_level_xp}`)

  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

setLevelTo32()
