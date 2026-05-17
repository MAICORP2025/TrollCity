const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState() {
  try {
    // Check if troll_bank_credit_coins function exists
    const { error } = await supabase.rpc('troll_bank_credit_coins', {
      p_user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      p_coins: 1,
      p_bucket: 'paid',
      p_source: 'check',
      p_ref_id: 'check_exists'
    });

    if (error) {
        console.log("RPC check error:", error.message);
        if (error.message.includes('function public.troll_bank_credit_coins(uuid, integer, text, text, text) does not exist')) {
            console.log("Troll Bank RPC does NOT exist.");
        } else {
             console.log("Troll Bank RPC might exist but failed (expected with dummy data).");
        }
    } else {
        console.log("Troll Bank RPC exists!");
    }

    // Check if bank_feature_flags table exists by trying to select from it
    const { error: tableError } = await supabase
        .from('bank_feature_flags')
        .select('*')
        .limit(1);

    if (tableError) {
        console.log("Table check error:", tableError.message);
    } else {
        console.log("bank_feature_flags table exists!");
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkState();
