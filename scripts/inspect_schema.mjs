
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    console.log('Inspecting Tables...');
    
    // Check user_profiles
    const { data: profiles, error: pError } = await supabase.from('user_profiles').select('*').limit(1);
    if (profiles && profiles.length > 0) console.log('User Profiles Keys:', Object.keys(profiles[0]));
    else console.log('User Profiles Error/Empty:', pError);

    // Check streams
    const { data: streams, error: sError } = await supabase.from('streams').select('*').limit(1);
    if (streams && streams.length > 0) console.log('Streams Keys:', Object.keys(streams[0]));
    else console.log('Streams Error/Empty:', sError);

    // Check troll_court_cases
    const { data: court, error: cError } = await supabase.from('troll_court_cases').select('*').limit(1);
    if (court && court.length > 0) console.log('Court Keys:', Object.keys(court[0]));
    else console.log('Court Error/Empty:', cError);
}

inspect();
