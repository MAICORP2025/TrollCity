import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('missing env');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const battleId = 'bdca0c30-ab56-415c-b98c-6cfb15ad69f3';

const { data: battle, error: battleError } = await supabase
  .from('battles')
  .select('id,status,host_ready,opponent_ready,challenger_stream_id,opponent_stream_id,started_at,ends_at,created_at,updated_at')
  .eq('id', battleId)
  .maybeSingle();

if (battleError) {
  console.error(battleError);
  process.exit(1);
}

const streamIds = [battle?.challenger_stream_id, battle?.opponent_stream_id].filter(Boolean);
const { data: streams, error: streamsError } = streamIds.length
  ? await supabase.from('streams').select('id,battle_status,is_battle,battle_id,battle_mode,status').in('id', streamIds)
  : { data: [], error: null };

if (streamsError) {
  console.error(streamsError);
  process.exit(1);
}

const { data: participants, error: participantsError } = await supabase
  .from('battle_participants')
  .select('battle_id,user_id,team,role,source_stream_id,joined_at')
  .eq('battle_id', battleId)
  .order('joined_at', { ascending: true });

if (participantsError) {
  console.error(participantsError);
  process.exit(1);
}

console.log(JSON.stringify({ battle, streams, participants }, null, 2));
