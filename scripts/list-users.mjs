
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars manually
let envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
    envPath = path.resolve(__dirname, '../.env');
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envConfig = Object.fromEntries(
    envContent.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => {
            const [key, ...val] = line.split('=');
            return [key.trim(), val.join('=').trim().replace(/^["']|["']$/g, '')];
        })
);

const supabaseUrl = envConfig.VITE_SUPABASE_URL || envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listUsers() {
    console.log('--- LISTING ALL USERS ---');
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    
    if (error) {
        console.error('Error listing users:', error);
        return;
    }

    console.log(`Total users found: ${users.length}`);
    users.forEach(u => {
        console.log(`- ${u.email} (${u.id})`);
    });
}

listUsers();
