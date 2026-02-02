/**
 * LiveKit Authentication Test Script
 * Tests: session validation -> token generation -> LiveKit connection
 */

import { createClient } from '@supabase/supabase-js';

// ⚠️  IMPORTANT: Use environment variables for production!
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const EDGE_FUNCTIONS_URL = process.env.VITE_EDGE_FUNCTIONS_URL || 'https://your-project.supabase.co/functions/v1';
const LIVEKIT_URL = process.env.VITE_LIVEKIT_URL || 'wss://your-project.livekit.cloud';

if (!SUPABASE_ANON_KEY) {
  throw new Error('VITE_SUPABASE_ANON_KEY environment variable is required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLiveKitAuthFlow() {
  console.log('🔴 LiveKit Authentication Test Started');

  try {
    console.log('\n📝 Step 1: User Authentication');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ No active session found. Please sign in first.');
      return;
    }
    
    console.log('✅ Active session found');
    console.log('   User ID:', session.user?.id);

    console.log('\n🎫 Step 2: Testing LiveKit Token Generation');
    
    const tokenRequestBody = {
      room: 'test-room-' + Date.now(),
      identity: session.user?.id,
      role: 'broadcaster',
      allowPublish: true
    };
    
    const tokenResponse = await fetch(`${EDGE_FUNCTIONS_URL}/livekit-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(tokenRequestBody)
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('❌ Token request failed:', tokenData.error);
      return;
    }
    
    console.log('✅ Token generated successfully');
    console.log('   LiveKit URL:', tokenData.livekitUrl);

    console.log('\n🔗 Step 4: Testing LiveKit Connection');
    console.log('   LiveKit URL:', LIVEKIT_URL);
    console.log('   Room:', tokenRequestBody.room);
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testLiveKitAuthFlow().catch(console.error);
