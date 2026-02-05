
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPayoutEmailUpdate() {
  console.log('Testing Payout Email Update...');

  // 1. Create a test user
  const email = `test_payout_${Date.now()}@example.com`;
  const password = 'password123';
  
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) {
    console.error('Failed to create user:', authError);
    return;
  }

  const userId = authData.user.id;
  console.log('Created test user:', userId);

  // 2. Create profile (trigger usually handles this, but ensuring)
  // Wait a bit for trigger
  await new Promise(r => setTimeout(r, 2000));

  // 3. Log in as the user to get a session token (simulate client side)
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Failed to sign in:', signInError);
    return;
  }

  const userClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${signInData.session.access_token}`
      }
    }
  });

  // 4. Try to update payout_paypal_email
  const payoutEmail = 'payout_test@example.com';
  console.log(`Attempting to update payout_paypal_email to ${payoutEmail}...`);

  const { data, error } = await userClient
    .from('user_profiles')
    .update({ 
        payout_paypal_email: payoutEmail,
        updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select();

  if (error) {
    console.error('Update FAILED with error:', error);
  } else if (data && data.length > 0) {
    console.log('Update SUCCESS. Data:', data);
  } else {
    console.log('Update returned NO error but NO data (RLS likely blocked it silently).');
  }

  // 5. Verify persistence
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('payout_paypal_email')
    .eq('id', userId)
    .single();

  console.log('Final Profile Value:', profile);

  if (profile.payout_paypal_email === payoutEmail) {
    console.log('✅ Payout Email Saved Successfully');
  } else {
    console.log('❌ Payout Email NOT Saved');
  }

  // Cleanup
  await supabase.auth.admin.deleteUser(userId);
}

testPayoutEmailUpdate();
