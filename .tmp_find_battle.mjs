import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('missing env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: streams, error } = await supabase
  .from('streams')
  .select('id,user_id,status,is_battle,battle_id,battle_mode,battle_status,battle_start_time,battle_end_time,random_battle_queue_enabled,updated_at')
  .eq('battle_status', 'starting')
  .order('updated_at', { ascending: false });

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(JSON.stringify(streams, null, 2));
