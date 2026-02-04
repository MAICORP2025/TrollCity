import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('--- Project Verification ---');
console.log(`URL: ${url}`);

async function verify() {
  // Test 1: Connect with ANON key (Should work for public reads)
  console.log('\nTesting ANON key...');
  const supabaseAnon = createClient(url, anonKey);
  const { error: errorAnon } = await supabaseAnon.from('streams').select('count', { count: 'exact', head: true });
  
  if (errorAnon) {
    console.error('FAIL: ANON key failed:', errorAnon.message);
  } else {
    console.log('PASS: ANON key works. Project is active.');
  }

  // Test 2: Connect with SERVICE key (Should work for admin bypass)
  console.log('\nTesting SERVICE key...');
  try {
    const supabaseService = createClient(url, serviceKey);
    // Try to select from a table, relying on service role to bypass RLS if any, 
    // or just standard access. 
    // If the key is for a WRONG project, it should fail with 401 or similar.
    const { error: errorService } = await supabaseService.from('user_profiles').select('count', { count: 'exact', head: true });
    
    if (errorService) {
        console.error('FAIL: SERVICE key failed:', errorService.message);
        console.log('DIAGNOSIS: The SERVICE_ROLE_KEY does not match the project URL.');
    } else {
        console.log('PASS: SERVICE key works.');
    }
  } catch (e) {
      console.error('FAIL: SERVICE key threw error:', e.message);
  }
}

verify();
