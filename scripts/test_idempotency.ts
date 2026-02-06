
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yjxpwfalenorzrqxwmtr.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  console.log('--- Starting Idempotency Test ---');

  // 1. Get a test user
  const { data: users, error: userError } = await supabase
    .from('user_profiles')
    .select('id, troll_coins')
    .gt('troll_coins', 1000)
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.error('Failed to find test user:', userError);
    return;
  }

  const user = users[0];
  console.log(`Using User: ${user.id} (Balance: ${user.troll_coins})`);

  // 2. Define Transaction Params
  const idempotencyKey = crypto.randomUUID();
  const amount = 5;
  const params = {
    p_sender_id: user.id,
    p_receiver_id: user.id, // Send to self to avoid messing up others
    p_coin_amount: amount,
    p_source: 'test_idempotency',
    p_item: 'Test Item',
    p_idempotency_key: idempotencyKey
  };

  console.log(`Generated Key: ${idempotencyKey}`);

  // 3. First Call
  console.log('\n--- Call 1 (Fresh) ---');
  const { data: res1, error: err1 } = await supabase.rpc('spend_coins', params);

  if (err1) {
    console.error('Call 1 Failed:', err1);
    return;
  }
  console.log('Call 1 Result:', res1);

  if (!res1.success) {
    console.error('Call 1 returned success=false');
    return;
  }

  // 4. Second Call (Retry)
  console.log('\n--- Call 2 (Retry) ---');
  const { data: res2, error: err2 } = await supabase.rpc('spend_coins', params);

  if (err2) {
    console.error('Call 2 Failed:', err2);
    return;
  }
  console.log('Call 2 Result:', res2);

  // 5. Verify Logic
  const isIdempotent = 
    res2.success === true &&
    res2.gift_id === res1.gift_id &&
    res2.message?.includes('idempotent');

  if (isIdempotent) {
    console.log('\n✅ SUCCESS: Idempotency verified. Same gift_id returned.');
  } else {
    console.error('\n❌ FAILURE: Responses differ or not marked idempotent.');
    console.log('Diff:', {
      id1: res1.gift_id,
      id2: res2.gift_id,
      msg2: res2.message
    });
  }

  // 6. Verify Database State
  const { data: txs } = await supabase
    .from('coin_transactions')
    .select('id, idempotency_key, created_at')
    .eq('idempotency_key', idempotencyKey);

  console.log('\nDB Records for key:', txs);

  if (txs && txs.length === 1) {
    console.log('✅ DB Check: Only 1 transaction row found.');
  } else {
    console.error(`❌ DB Check: Found ${txs?.length} rows.`);
  }

  // 7. Verify Balance Deduction (Should be 1x amount)
  const { data: updatedUser } = await supabase
    .from('user_profiles')
    .select('troll_coins')
    .eq('id', user.id)
    .single();
  
  const expectedBalance = user.troll_coins - amount;
  // Note: There might be slight drift if other things happened, but roughly...
  console.log(`Balance: Start=${user.troll_coins}, End=${updatedUser?.troll_coins}, Expected=${expectedBalance}`);
  
  if (updatedUser?.troll_coins === expectedBalance) {
    console.log('✅ Balance Check: Exact deduction match.');
  } else {
    console.warn('⚠️ Balance Check: Mismatch (could be due to other activity or logic).');
  }
}

main();
