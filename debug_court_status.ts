
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('Checking court sessions...');
  
  // Check court_sessions table
  const { data: sessions, error } = await supabase
    .from('court_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching sessions:', error);
  } else {
    console.log('Recent sessions:', sessions);
  }

  // Check get_current_court_session RPC
  console.log('Calling get_current_court_session RPC...');
  const { data: currentSession, error: rpcError } = await supabase.rpc('get_current_court_session');
  if (rpcError) {
    console.error('RPC error:', rpcError);
  } else {
    console.log('RPC result:', currentSession);
  }
}

main();
