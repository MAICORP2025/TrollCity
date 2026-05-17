
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIG ---
const TOTAL_VIEWERS = 100;
const BATCH_SIZE = 5; // Reduced to avoid Auth rate limits
const TEST_GIFT_SLUG = 'rose'; 
// --------------

// Load env vars
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

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseAnonKey = envConfig.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

// Admin client for checking balances directly
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

// Helper to create authenticated client with retry
async function createClientForUser(email, password, retries = 3) {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    for (let i = 0; i < retries; i++) {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (!error) {
            return { client, user: data.user, email };
        }
        
        // If error, wait and retry
        // console.warn(`Login attempt ${i+1} failed for ${email}: ${error.message}`);
        if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
    }
    
    return null;
}

// Helper for batch processing with delay
async function runBatch(items, fn, batchSize = BATCH_SIZE) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        // Add jitter/delay
        await new Promise(r => setTimeout(r, 500)); 
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
        process.stdout.write(`.`); // Progress indicator
    }
    console.log(''); // Newline
    return results;
}

async function run() {
    console.log('--- STARTING 100 USER HEAVY STRESS TEST ---');
    const startTime = Date.now();

    try {
        // 1. LOGIN USERS
        console.log(`Logging in 1 Streamer + ${TOTAL_VIEWERS} Viewers (Batch Size: ${BATCH_SIZE})...`);
        const streamer = await createClientForUser('heavy_streamer1@example.com', 'password123');
        if (!streamer) throw new Error('Streamer login failed');

        const viewers = [];
        for (let i = 1; i <= TOTAL_VIEWERS; i++) {
            viewers.push({ email: `heavy_viewer${i}@example.com`, password: 'password123' });
        }

        const viewerClients = (await runBatch(viewers, async (creds) => {
            return await createClientForUser(creds.email, creds.password);
        })).filter(c => c !== null);

        console.log(`Logged in ${viewerClients.length} viewers.`);
        if (viewerClients.length < TOTAL_VIEWERS * 0.8) { // Allow 20% failure
            throw new Error(`Too many login failures (${TOTAL_VIEWERS - viewerClients.length}), aborting test.`);
        }

        // 2. START BROADCAST
        console.log('\n--- STARTING BROADCAST ---');
        const { data: streamData, error: streamError } = await streamer.client
            .from('streams')
            .insert({
                user_id: streamer.user.id,
                title: 'HEAVY LOAD TEST STREAM',
                status: 'live',
                is_live: true,
                box_price_amount: 0,
                box_price_type: 'flat'
            })
            .select()
            .single();

        if (streamError) throw new Error(`Stream start failed: ${streamError.message}`);
        console.log(`Stream ID: ${streamData.id}`);

        // 3. START BATTLE
        console.log('\n--- STARTING BATTLE ---');
        // Find or create opponent (heavy_streamer2)
        const opponent = await createClientForUser('heavy_streamer2@example.com', 'password123');
        if (opponent) {
            // Create dummy stream for opponent
             const { data: oppStream } = await opponent.client
            .from('streams')
            .insert({
                user_id: opponent.user.id,
                title: 'Opponent Stream',
                status: 'live',
                is_live: true
            })
            .select().single();
            
            if (oppStream) {
                const { data: battleData, error: battleError } = await streamer.client
                    .from('battles')
                    .insert({
                        challenger_stream_id: streamData.id,
                        opponent_stream_id: oppStream.id,
                        status: 'active',
                        score_challenger: 0,
                        score_opponent: 0
                    })
                    .select()
                    .single();
                
                if (battleError) console.error('Battle start failed:', battleError.message);
                else console.log(`Battle started: ${battleData.id}`);
            }
        }

        // 4. MASS GIFTING (STRESS TEST)
        console.log('\n--- EXECUTING MASS GIFTING ---');
        // Get a gift ID
        const { data: gift } = await adminClient.from('gifts').select('*').eq('slug', TEST_GIFT_SLUG).single();
        const giftId = gift ? gift.id : 'rose'; // Fallback

        let successGifts = 0;
        let failGifts = 0;

        await runBatch(viewerClients, async (viewer) => {
            const { data, error } = await viewer.client.rpc('send_gift_in_stream', {
                p_sender_id: viewer.user.id,
                p_receiver_id: streamer.user.id,
                p_stream_id: streamData.id,
                p_gift_id: giftId,
                p_quantity: 1,
                p_metadata: { test_batch: true }
            });
            if (error || (data && !data.success)) {
                failGifts++;
            } else {
                successGifts++;
            }
        });

        console.log(`Gifting Result: ${successGifts} Success, ${failGifts} Failed`);

        // 5. MASS CHAT
        console.log('\n--- EXECUTING MASS CHAT ---');
        let successChat = 0;
        await runBatch(viewerClients, async (viewer) => {
            const { error } = await viewer.client
                .from('stream_messages')
                .insert({
                    stream_id: streamData.id,
                    user_id: viewer.user.id,
                    content: `Hello from ${viewer.email} at ${Date.now()}`
                });
            if (!error) successChat++;
        });
        console.log(`Chat Result: ${successChat} Messages Sent`);

        // 6. SEAT PRICING & INSTANT TRANSFER
        console.log('\n--- TESTING SEAT PRICING & INSTANT TRANSFER ---');
        // Update stream to paid box
        const BOX_PRICE = 500;
        const { data: updateData, error: updateError } = await streamer.client.from('streams').update({ 
            box_price_amount: BOX_PRICE,
            box_price_type: 'flat',
            box_count: 5 // Ensure boxes exist
        }).eq('id', streamData.id).select();

        if (updateError) console.error('Stream Update Failed:', updateError);
        else console.log('Stream Updated:', updateData);

        // Verify Stream State
        const { data: streamVerify } = await adminClient.from('streams').select('*').eq('id', streamData.id).single();
        console.log('Stream Verify:', streamVerify.box_price_amount, streamVerify.box_price_type);


        // Get initial balances
        const { data: initialStreamerBal } = await adminClient.from('user_profiles').select('troll_coins').eq('id', streamer.user.id).single();
        const guest = viewerClients[0];
        const { data: initialGuestBal } = await adminClient.from('user_profiles').select('troll_coins').eq('id', guest.user.id).single();

        console.log(`Initial Balances - Streamer: ${initialStreamerBal.troll_coins}, Guest: ${initialGuestBal.troll_coins}`);

        // Join Box
        const { data: joinData, error: joinError } = await guest.client.rpc('join_stream_box', {
            p_stream_id: streamData.id,
            p_user_id: guest.user.id
        });

        if (joinError) console.error('Join Box Failed:', joinError.message);
        else console.log('Join Box RPC Result:', joinData);

        // Verify Balances
        const { data: finalStreamerBal } = await adminClient.from('user_profiles').select('troll_coins').eq('id', streamer.user.id).single();
        const { data: finalGuestBal } = await adminClient.from('user_profiles').select('troll_coins').eq('id', guest.user.id).single();

        console.log(`Final Balances   - Streamer: ${finalStreamerBal.troll_coins}, Guest: ${finalGuestBal.troll_coins}`);
        
        const streamerDiff = finalStreamerBal.troll_coins - initialStreamerBal.troll_coins;
        const guestDiff = initialGuestBal.troll_coins - finalGuestBal.troll_coins;

        if (streamerDiff === BOX_PRICE && guestDiff === BOX_PRICE) {
            console.log('✅ SUCCESS: Seat pricing instant transfer verified.');
        } else {
            console.error(`❌ FAILURE: Seat pricing mismatch. Streamer +${streamerDiff}, Guest -${guestDiff}. Expected ${BOX_PRICE}.`);
        }

        // 7. GUEST TO GUEST GIFTING
        console.log('\n--- TESTING GUEST TO GUEST GIFTING ---');
        // Viewer 2 joins another box (assume they can pay)
        const guest2 = viewerClients[1];
        await guest2.client.rpc('join_stream_box', { p_stream_id: streamData.id, p_user_id: guest2.user.id });
        
        // Guest 1 sends gift to Guest 2
        console.log('Guest 1 sending gift to Guest 2...');
        const { data: g2gData, error: g2gError } = await guest.client.rpc('send_gift_in_stream', {
            p_sender_id: guest.user.id,
            p_receiver_id: guest2.user.id,
            p_stream_id: streamData.id,
            p_gift_id: giftId,
            p_quantity: 1
        });

        if (g2gError) console.error('Guest-to-Guest Gift Failed:', g2gError.message);
        else console.log('Guest-to-Guest Gift Success:', g2gData);


        // 8. STREAM CONTROLS (RGB, NEON, THEMES)
        console.log('\n--- TESTING STREAM CONTROLS ---');
        // Purchase/Enable RGB
        const { error: rgbError } = await streamer.client.rpc('purchase_rgb_broadcast', {
            p_stream_id: streamData.id,
            p_enable: true
        });
        if (rgbError) console.error('RGB Toggle Failed:', rgbError.message);
        else console.log('RGB Toggle Success');

        // Verify in DB
        const { data: streamCheck } = await adminClient.from('streams').select('has_rgb_effect, rgb_purchased').eq('id', streamData.id).single();
        console.log('Stream State:', streamCheck);

        // 9. ASSIGN BROADOFFICER
        console.log('\n--- TESTING BROADOFFICER ASSIGNMENT ---');
        const officerCandidate = viewerClients[2];
        const { error: officerError } = await streamer.client.rpc('assign_broadofficer', {
            p_user_id: officerCandidate.user.id
        });
        if (officerError) console.error('Assign Officer Failed:', officerError.message);
        else console.log('Assign Officer Success');


        // 10. TROLLPODS
        console.log('\n--- TESTING TROLLPODS ---');
        const { data: pod, error: podError } = await streamer.client
            .from('pod_rooms')
            .insert({
                host_id: streamer.user.id,
                title: 'Test Pod',
                is_live: true
            })
            .select()
            .single();
        
        if (podError) {
            console.error('Pod Create Failed:', podError.message);
        } else {
            console.log(`Pod Created: ${pod.id}`);
        }

        // SUMMARY
        console.log('\n--- TEST SUMMARY ---');
        console.log(`Duration: ${(Date.now() - startTime) / 1000}s`);
        console.log(`Users Logged In: ${viewerClients.length}`);
        console.log(`Gifts Sent: ${successGifts}`);
        console.log(`Messages Sent: ${successChat}`);
        
    } catch (err) {
        console.error('CRITICAL TEST FAILURE:', err);
    } finally {
        console.log('Test Complete.');
        process.exit(0);
    }
}

run();
