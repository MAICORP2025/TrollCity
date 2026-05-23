import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('missing env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: pendingBattles, error: pendingError } = await supabase
  .from('battles')
  .select('id,status,started_at,ends_at')
  .eq('status', 'pending')
  .order('created_at', { ascending: true });

if (pendingError) {
  throw pendingError;
}

const results = [];
for (const battle of pendingBattles || []) {
  const { data, error: rpcError } = await supabase.rpc('activate_random_battle', {
    p_battle_id: battle.id
  });

  results.push({
    battle_id: battle.id,
    rpc: data,
    error: rpcError?.message || null
  });
}

console.log(JSON.stringify({ pendingCount: pendingBattles?.length || 0, results }, null, 2));
