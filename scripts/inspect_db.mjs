import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, serviceKey);

async function inspect() {
    console.log('--- DB INSPECTION ---');
    
    // 1. Get a valid user ID
    const { data: users } = await supabase.auth.admin.listUsers();
    const userId = users.users[0]?.id;
    console.log('Valid User ID:', userId);
    
    // 2. Inspect gift_ledger columns
    // (We can't easily desc table via JS client, but we can try to insert dummy data and see error, or select * limit 1)
    const { data: gift, error: giftError } = await supabase.from('gift_ledger').select('*').limit(1);
    console.log('Gift Ledger Sample:', gift ? Object.keys(gift[0] || {}) : 'Empty');
    if (giftError) console.log('Gift Error:', giftError.message);
    
    // 3. Inspect broadcaster_stats
    const { data: stats, error: statsError } = await supabase.from('broadcaster_stats').select('*').limit(1);
    console.log('Broadcaster Stats Sample:', stats ? Object.keys(stats[0] || {}) : 'Empty');
    if (statsError) console.log('Stats Error:', statsError.message);
}

inspect();
