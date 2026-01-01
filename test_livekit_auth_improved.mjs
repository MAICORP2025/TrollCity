/**
 * LiveKit Authentication Test Script
 * Tests the complete flow: session validation -> token generation -> LiveKit connection
 */

import { createClient } from '@supabase/supabase-js';

// Configuration - update these with your actual values
const SUPABASE_URL = 'https://yjxpwfalenorzrqxwmtr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqeHB3ZmFsZW5vcnpycXh3bXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQwNTY2NTEsImV4cCI6MjA0OTYzMjY1MX0.VxJ3cW8l5Wj3cYb4q2L1Y9aWnX6h2sG9mZ8kQ1bN3cE';
const EDGE_FUNCTIONS_URL = 'https://yjxpwfalenorzrqxwmtr.supabase.co/functions/v1';
const LIVEKIT_URL = 'wss://trollcity2025-jav85l1w.livekit.cloud';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLiveKitAuthFlow() {
  console.log('🔴 LiveKit Authentication Test Started');
  console.log('='.repeat(50));

  try {
    // Step 1: Test user login (you'll need to provide credentials)
    console.log('\n📝 Step 1: User Authentication');
    console.log('Please sign in manually or provide test credentials...');
    
    // For testing, let's assume user is already logged in
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ No active session found. Please sign in first.');
      console.log('💡 Tip: Open the app and sign in, then run this test again.');
      return;
    }
    
    console.log('✅ Active session found');
    console.log('   User ID:', session.user?.id);
    console.log('   Expires at:', new Date(session.expires_at * 1000).toISOString());

    // Step 2: Test LiveKit token endpoint
    console.log('\n🎫 Step 2: Testing LiveKit Token Generation');
    
    const tokenRequestBody = {
      room: 'test-room-' + Date.now(),
      identity: session.user?.id,
      user_id: session.user?.id,
      role: 'broadcaster',
      allowPublish: true,
      level: 1
    };
    
    console.log('   Request body:', tokenRequestBody);
    
    const tokenResponse = await fetch(`${EDGE_FUNCTIONS_URL}/livekit-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'x-client-info': 'trollcity-test'
      },
      body: JSON.stringify(tokenRequestBody)
    });
    
    console.log('   Response status:', tokenResponse.status);
    console.log('   Response headers:', Object.fromEntries(tokenResponse.headers.entries()));
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenResponse.ok) {
      console.error('❌ Token request failed:');
      console.error('   Error:', tokenData.error);
      console.error('   Full response:', tokenData);
      return;
    }
    
    console.log('✅ Token generated successfully');
    console.log('   Token preview:', tokenData.token?.substring(0, 50) + '...');
    console.log('   LiveKit URL:', tokenData.livekitUrl);
    console.log('   Publish allowed:', tokenData.allowPublish);

    // Step 3: Validate JWT token format
    console.log('\n🔐 Step 3: Validating JWT Token');
    
    const tokenParts = tokenData.token.split('.');
    if (tokenParts.length !== 3) {
      console.error('❌ Invalid JWT format - expected 3 parts');
      return;
    }
    
    try {
      const payload = JSON.parse(decodeURIComponent(escape(atob(tokenParts[1]))));
      console.log('✅ Valid JWT format');
      console.log('   Token payload:', {
        sub: payload.sub,
        iss: payload.iss,
        exp: new Date(payload.exp * 1000).toISOString(),
        metadata: payload.metadata ? JSON.parse(payload.metadata) : null
      });
    } catch (e) {
      console.error('❌ Failed to decode JWT payload:', e.message);
      return;
    }

    // Step 4: Test LiveKit connection (optional - requires livekit-client)
    console.log('\n🔗 Step 4: Testing LiveKit Connection');
    console.log('   LiveKit URL:', LIVEKIT_URL);
    console.log('   Room:', tokenRequestBody.room);
    console.log('   Identity:', tokenRequestBody.identity);
    console.log('   ⚠️  Note: Full connection test requires livekit-client library');
    
    console.log('\n🎉 Test completed successfully!');
    console.log('💡 Next steps:');
    console.log('   1. Deploy the updated edge function: npx supabase functions deploy livekit-token');
    console.log('   2. Test in the actual app by starting a broadcast');
    console.log('   3. Check browser console for detailed logs');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Test different scenarios
async function runAllTests() {
  console.log('🧪 Running comprehensive LiveKit authentication tests...\n');
  
  await testLiveKitAuthFlow();
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Test suite completed');
}

// Export for use in other scripts
export { testLiveKitAuthFlow };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}