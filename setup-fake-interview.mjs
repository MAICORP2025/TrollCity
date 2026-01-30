/**
 * Fake Interview Test Setup Script
 * Run this script to set up a fake interview for testing purposes
 * 
 * Usage: node setup-fake-interview.mjs
 */

import { createClient } from '@supabase/supabase-js'

// Supabase configuration - replace with your actual credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupFakeInterview() {
  console.log('🎭 Setting up fake interview test...\n')

  try {
    // Get the current user (admin) to send notification to
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      console.log('❌ Please login first to get your user ID')
      return
    }

    console.log(`✓ Current user ID: ${user.id}`)

    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    console.log(`✓ User role: ${profile?.role}`)

    // Step 1: Create a fake application
    console.log('\n📝 Step 1: Creating fake application...')
    
    // First, check if we need to create a fake applicant user or use current user
    let fakeApplicantId = user.id // Use current user for testing (as both applicant and admin)
    
    // Check for existing application
    const { data: existingApp } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', fakeApplicantId)
      .eq('type', 'troll_officer')
      .maybeSingle()

    let application = existingApp
    
    if (!existingApp) {
      const { data: newApp, error: appError } = await supabase
        .from('applications')
        .insert({
          user_id: fakeApplicantId,
          type: 'troll_officer',
          status: 'approved',
          experience: 'Test applicant for interview demo',
          motivation: 'I want to help moderate the community!',
          availability: 'Full time',
          skills: ['Communication', 'Conflict Resolution'],
          created_at: new Date().toISOString(),
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .select()
        .single()

      if (appError) {
        console.log('⚠️  Error creating application:', appError.message)
      } else {
        application = newApp
        console.log(`✓ Created application: ${application.id}`)
      }
    } else {
      console.log(`✓ Using existing application: ${application.id}`)
    }

    // Step 2: Create a fake interview session
    console.log('\n📅 Step 2: Creating fake interview session...')
    
    const scheduledTime = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now
    
    // Check for existing interview
    const { data: existingInterview } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('user_id', fakeApplicantId)
      .in('status', ['active', 'completed'])
      .maybeSingle()

    let interview = existingInterview
    
    if (!existingInterview && application) {
      const { data: newInterview, error: interviewError } = await supabase
        .from('interview_sessions')
        .insert({
          application_id: application.id,
          user_id: fakeApplicantId,
          interviewer_id: user.id, // Current user as interviewer
          scheduled_at: scheduledTime,
          status: 'active', // Use 'active' instead of 'in_progress'
          notes: 'Test interview session - fake applicant for demo purposes'
        })
        .select()
        .single()

      if (interviewError) {
        console.log('⚠️  Error creating interview:', interviewError.message)
      } else {
        interview = newInterview
        console.log(`✓ Created interview session: ${interview.id}`)
        console.log(`✓ Scheduled for: ${new Date(scheduledTime).toLocaleString()}`)
      }
    } else if (existingInterview) {
      // Update existing interview to active
      await supabase
        .from('interview_sessions')
        .update({ status: 'active' })
        .eq('id', existingInterview.id)
      interview = existingInterview
      console.log(`✓ Using existing interview session: ${interview.id}`)
    }

    // Step 3: Send notification to admin
    console.log('\n🔔 Step 3: Sending notification to admin...')
    
    const notification = {
      user_id: user.id,
      type: 'interview_scheduled',
      title: '🎭 Test Interview Scheduled',
      message: `A test applicant has scheduled an interview for Troll Officer position.`,
      read: false,
      created_at: new Date().toISOString()
    }

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notification)

    if (notifError) {
      console.log('⚠️  Notification might already exist:', notifError.message)
    } else {
      console.log('✓ Notification sent successfully!')
    }

    console.log('\n✅ Fake interview test setup complete!')
    console.log('\n📋 Next steps:')
    console.log('   1. Go to /career and click the "Interviews" tab')
    console.log('   2. OR go directly to /interview/' + (interview?.id || '[INTERVIEW_ID]'))
    console.log('   3. Click "Start Interview" or "Rejoin Interview"')
    console.log('   4. Click "Enable Test Mode" to see fake avatar instead of camera')
    
    if (interview) {
      console.log(`\n🔗 Direct link: /interview/${interview.id}`)
    }

  } catch (error) {
    console.error('❌ Error setting up fake interview:', error)
  }
}

setupFakeInterview()
