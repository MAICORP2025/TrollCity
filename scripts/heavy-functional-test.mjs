
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function createClientForUser(email, password) {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { client, user: data.user };
}

async function getBalance(userId) {
    const { data } = await adminClient
        .from('user_profiles')
        .select('troll_coins')
        .eq('id', userId)
        .single();
    return data?.troll_coins || 0;
}

async function run() {
    console.log('--- STARTING HEAVY FUNCTIONAL TEST ---');

    try {
        // 1. Setup Users
        const streamer = await createClientForUser('heavy_streamer1@example.com', 'password123');
        const guest1 = await createClientForUser('heavy_viewer1@example.com', 'password123');
        const guest2 = await createClientForUser('heavy_viewer2@example.com', 'password123');
        
        console.log(`Streamer: ${streamer.user.id}`);
        console.log(`Guest 1: ${guest1.user.id}`);
        console.log(`Guest 2: ${guest2.user.id}`);

        // 2. Create Stream (TrollPod test included implicitly as a stream type or separate entity?)
        // Let's create a regular stream first for the main tests.
        const { data: streamData, error: streamError } = await streamer.client
            .from('streams')
            .insert({
                user_id: streamer.user.id,
                title: 'Heavy Functional Test Stream',
                status: 'live',
                is_live: true,
                box_price_amount: 0, // Start free
                box_price_type: 'flat'
            })
            .select()
            .single();

        if (streamError) throw new Error(`Stream creation failed: ${streamError.message}`);
        console.log(`Stream created: ${streamData.id}`);

        // 3. Test TrollPod Creation (Separate Table)
        console.log('Testing TrollPod creation...');
        const { data: podData, error: podError } = await streamer.client
            .from('pod_rooms')
            .insert({
                host_id: streamer.user.id,
                title: 'Test TrollPod',
                is_live: true,
                viewer_count: 0
            })
            .select()
            .single();
        
        if (podError) console.error('TrollPod creation failed (might be schema mismatch, skipping):', podError.message);
        else console.log(`TrollPod created: ${podData.id}`);

        // 4. Test Themes & Frames
        console.log('Testing Theme Purchase...');
        // Need to find a valid theme slug
        const { data: theme } = await adminClient.from('broadcast_background_themes').select('*').limit(1).single();
        if (theme) {
            // Assume purchased for test sake or just try update
            const { error: themeError } = await streamer.client
                .from('streams')
                .update({ active_theme_url: theme.image_url })
                .eq('id', streamData.id);
            if (themeError) console.error('Theme apply failed:', themeError.message);
            else console.log('Theme applied successfully');
        } else {
            console.log('No themes found to test.');
        }

        console.log('Testing RGB Frame...');
        // Try RPC
        const { error: rgbError } = await streamer.client.rpc('purchase_rgb_broadcast', {
            p_stream_id: streamData.id,
            p_enable: true
        });
        if (rgbError) console.error('RGB Purchase failed:', rgbError.message); // Might fail due to funds or logic, but that's a test result
        else console.log('RGB Frame RPC executed.');

        // 5. Test Seat Pricing & Instant Transfer
        console.log('Testing Seat Pricing & Instant Transfer...');
        const seatPrice = 50;
        
        // Update stream price
        await streamer.client
            .from('streams')
            .update({ box_price_amount: seatPrice, box_price_type: 'flat' })
            .eq('id', streamData.id);
        
        const initialStreamerBalance = await getBalance(streamer.user.id);
        const initialGuestBalance = await getBalance(guest1.user.id);
        
        console.log(`Initial Balances - Streamer: ${initialStreamerBalance}, Guest: ${initialGuestBalance}`);

        // Guest joins box
        const { data: joinData, error: joinError } = await guest1.client.rpc('join_stream_box', {
            p_stream_id: streamData.id,
            p_user_id: guest1.user.id
        });

        if (joinError || (joinData && !joinData.success)) {
            console.error('Join Box Failed:', joinError || joinData);
        } else {
            console.log('Guest joined box.');
            
            const finalStreamerBalance = await getBalance(streamer.user.id);
            const finalGuestBalance = await getBalance(guest1.user.id);
            
            console.log(`Final Balances - Streamer: ${finalStreamerBalance}, Guest: ${finalGuestBalance}`);
            
            const streamerDiff = finalStreamerBalance - initialStreamerBalance;
            const guestDiff = initialGuestBalance - finalGuestBalance;

            if (guestDiff === seatPrice && streamerDiff === seatPrice) {
                console.log('SUCCESS: Seat pricing deducted from guest and added to streamer instantly.');
            } else {
                console.error(`FAILURE: Seat pricing mismatch. Guest Paid: ${guestDiff}, Streamer Received: ${streamerDiff}`);
                // NOTE: This is likely where it will fail based on my code analysis
            }
        }

        // 6. Test Guest-to-Guest Gifting
        console.log('Testing Guest-to-Guest Gifting...');
        // Guest 2 joins box first (free for now to simplify, or pay)
        // Let's reset price to 0 for Guest 2
        await streamer.client.from('streams').update({ box_price_amount: 0 }).eq('id', streamData.id);
        await guest2.client.rpc('join_stream_box', { p_stream_id: streamData.id, p_user_id: guest2.user.id });

        // Guest 1 sends gift to Guest 2
        // We need a valid gift ID.
        const { data: gift } = await adminClient.from('gifts').select('*').limit(1).single();
        if (gift) {
            const { data: giftResult, error: giftError } = await guest1.client.rpc('send_gift_in_stream', {
                p_stream_id: streamData.id,
                p_sender_id: guest1.user.id,
                p_receiver_id: guest2.user.id, // Sending to Guest 2
                p_gift_id: gift.id,
                p_quantity: 1,
                p_metadata: {}
            });
            
            if (giftError) console.error('Guest Gifting Failed:', giftError);
            else console.log('Guest-to-Guest Gift Sent:', giftResult);
        } else {
            console.log('No gifts found to test.');
        }

        // 7. Test Closed Box
        console.log('Testing Closed Box...');
        // Close the box (set count to 0)
        // First check if set_stream_box_count exists
        const { error: closeError } = await streamer.client.rpc('set_stream_box_count', {
            p_stream_id: streamData.id,
            p_new_box_count: 0
        });

        if (closeError) console.log('set_stream_box_count RPC not found or failed, skipping closed box test.');
        else {
            console.log('Box count set to 0.');
            // Try to join with a new guest (Guest 2 is already in, let's kick him or use Guest 1 again? Guest 1 is in too.)
            // We need a Guest 3 or just fail to join.
            // But wait, does join_stream_box CHECK box_count?
            // The migration I read didn't show it checking box_count.
            // If it fails to check, I need to implement that fix.
        }

        // Cleanup
        await streamer.client.from('streams').update({ is_live: false }).eq('id', streamData.id);
        if (podData) await streamer.client.from('pod_rooms').update({ is_live: false }).eq('id', podData.id);

    } catch (err) {
        console.error('Test Crashed:', err);
    }
    
    console.log('--- FUNCTIONAL TEST COMPLETE ---');
}

run();
