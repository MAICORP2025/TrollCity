import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) throw new Error('VITE_SUPABASE_ANON_KEY required');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsurance() {
  try {
    const { data, error } = await supabase.from('insurance_options').select('*').limit(5);
    console.log('Options:', data);
    if (error) console.error('Error:', error);
    else console.log('✅ Test passed');
  } catch (err) {
    console.error('Exception:', err);
  }
}

testInsurance();
