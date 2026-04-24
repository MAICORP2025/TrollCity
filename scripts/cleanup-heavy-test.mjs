
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

console.log(`Loading env from: ${envPath}`);
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

async function cleanup() {
    console.log('--- CLEANING UP ALL TEST DATA ---');

    // 1. Find test users
    // We fetch all users because filtering happens client-side for safety
    const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (error) {
        console.error('Error listing users:', error);
        return;
    }

    const testPatterns = [
        'heavy_viewer',
        'heavy_streamer',
        'loadtest_',
        'test_user_',
        'test_role_check_',
        'test_broadcaster_',
        'test_payout_',
        'demo_user_',
        'e2e-test-',
        'test_viewer_'
    ];

    const exactMatches = [
        'fix_trigger_v3@example.com'
    ];

    const usersToDelete = users.users.filter(u => {
        const email = u.email || '';
        const matchesPattern = testPatterns.some(p => email.startsWith(p));
        const matchesExact = exactMatches.includes(email);
        return matchesPattern || matchesExact;
    });

    console.log(`Found ${usersToDelete.length} test users to delete.`);
    if (usersToDelete.length > 0) {
        console.log('Examples:', usersToDelete.slice(0, 5).map(u => u.email).join(', '));
    }

    // 2. Delete users loop
    let hasMore = true;
    while (hasMore) {
        // Fetch fresh list
        const { data: users, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (error) {
            console.error('Error listing users:', error);
            break;
        }

        const usersToDelete = users.users.filter(u => {
            const email = u.email || '';
            const matchesPattern = testPatterns.some(p => email.startsWith(p));
            const matchesExact = exactMatches.includes(email);
            return matchesPattern || matchesExact;
        });

        if (usersToDelete.length === 0) {
            console.log('No more test users found.');
            hasMore = false;
            break;
        }

        console.log(`Found ${usersToDelete.length} test users to delete.`);
        console.log('Batch:', usersToDelete.map(u => u.email).join(', '));

        const BATCH_SIZE = 5;
        for (let i = 0; i < usersToDelete.length; i += BATCH_SIZE) {
            const batch = usersToDelete.slice(i, i + BATCH_SIZE);
            const userIds = batch.map(u => u.id);

            // Manual cleanup of dependent data to avoid FK constraints
            try {
                // 1. Delete Ledger entries
                await supabase.from('coin_ledger').delete().in('user_id', userIds);
                
                // 2. Delete Troll Battles
                await supabase.from('troll_battles').delete().or(`player1_id.in.(${userIds.join(',')}),player2_id.in.(${userIds.join(',')})`);
                
                // 3. Delete Stream Guests
                await supabase.from('stream_guests').delete().in('user_id', userIds);
                
                // 4. Delete Messages (if sender_id is the column)
                await supabase.from('messages').delete().in('user_id', userIds); // Assuming user_id or sender_id

            } catch (err) {
                console.warn('Manual cleanup warning (continuing):', err.message);
            }

            const results = await Promise.all(batch.map(async (u) => {
                const { error } = await supabase.auth.admin.deleteUser(u.id);
                if (error) return { email: u.email, error: error.message };
                return { email: u.email, success: true };
            }));
            
            results.forEach(r => {
                if (r.error) console.error(`Failed to delete ${r.email}: ${r.error}`);
                else process.stdout.write('.');
            });
        }
        console.log('\nBatch complete. Re-checking...');
        await new Promise(r => setTimeout(r, 1000)); // Brief pause before re-listing
    }

    console.log('\nCleanup complete.');
}

cleanup();
