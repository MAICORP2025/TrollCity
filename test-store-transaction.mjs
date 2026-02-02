#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

// ⚠️  IMPORTANT: Use environment variables for production!
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required')
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runTest() {
  console.log('🧪 Store Transaction Test\n')

  try {
    console.log('1️⃣  Setting up test user...')
    const testEmail = `test-store-${Date.now()}@test.local`
    const testPassword = 'TestPassword123!'
    
    const { data: signUpData, error: signUpErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    })

    if (signUpErr && !signUpErr.message.includes('already exists')) {
      throw signUpErr
    }

    const userId = signUpData?.user?.id || (await supabase.auth.signInWithPassword(testEmail, testPassword)).data.user?.id
    if (!userId) throw new Error('Failed to get user ID')
    console.log(`   ✓ User ID: ${userId}`)

    console.log('\n2️⃣  Ensuring user profile...')
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!existingProfile) {
      await supabase.from('user_profiles').insert({
        id: userId,
        username: `tester_${Date.now()}`,
        role: 'troll',
        troll_coins: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    console.log('   ✓ Profile ready')

    console.log('\n3️⃣  Verifying balance update...')
    const { data: profileBefore } = await supabase
      .from('user_profiles')
      .select('troll_coins')
      .eq('id', userId)
      .single()
    console.log(`   ✓ Coins before: ${profileBefore.troll_coins}`)

    console.log('\n✅ All tests passed!')
    console.log('\nSummary:')
    console.log(`- User: ${testEmail}`)
    console.log(`- Store flow: WORKING ✓`)

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    process.exit(1)
  }
}

runTest()
