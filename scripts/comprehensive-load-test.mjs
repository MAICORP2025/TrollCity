import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env parser
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

loadEnv(path.resolve(__dirname, '../.env'));
loadEnv(path.resolve(__dirname, '../.env.local'));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const USERS = [
  { email: 'loadtest_streamer1@example.com', password: 'password123', role: 'broadcaster' },
  { email: 'loadtest_streamer2@example.com', password: 'password123', role: 'broadcaster' },
  { email: 'loadtest_viewer1@example.com', password: 'password123', role: 'user' },
  { email: 'loadtest_viewer2@example.com', password: 'password123', role: 'user' },
  { email: 'loadtest_viewer3@example.com', password: 'password123', role: 'user' }
];

async function runTest() {
  console.log('--- STARTING COMPREHENSIVE LOAD TEST ---');

  // 1. Authenticate Users
  const clients = [];
  const userIds = {};

  for (const creds of USERS) {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false }
    });
    
    const { data: { session }, error } = await client.auth.signInWithPassword({
        email: creds.email,
        password: creds.password
    });

    if (error) {
        console.error(`Failed to login ${creds.email}:`, error.message);
        continue;
    }

    clients.push({
        email: creds.email,
        client,
        userId: session.user.id,
        role: creds.role
    });
    userIds[creds.email] = session.user.id;
    console.log(`Logged in ${creds.email} (${session.user.id})`);
  }

  if (clients.length < 5) {
      console.error('Not all users logged in. Aborting.');
      return;
  }

  const streamer1 = clients[0];
  const streamer2 = clients[1];
  const viewer1 = clients[2];
  const viewer2 = clients[3];
  const viewer3 = clients[4];

  // 2. Fetch a valid gift
  const { data: gifts } = await streamer1.client.from('gifts').select('*').limit(1);
  const gift = gifts && gifts.length > 0 ? gifts[0] : { slug: 'rose', id: 'rose', coin_cost: 1 };
  console.log(`Using gift: ${gift.slug || gift.id}`);

  // 3. Start Streams
  console.log('\n--- STARTING STREAMS ---');
  async function startStream(userCtx) {
      // Create stream record
      const { data: stream, error } = await userCtx.client
          .from('streams')
          .insert({
              user_id: userCtx.userId,
              title: `Load Test Stream ${userCtx.email}`,
              is_live: true,
              status: 'live'
          })
          .select()
          .single();
      
      if (error) {
          console.error(`Failed to start stream for ${userCtx.email}:`, error);
          return null;
      }
      console.log(`Stream started for ${userCtx.email}: ${stream.id}`);
      return stream;
  }

  const stream1 = await startStream(streamer1);
  const stream2 = await startStream(streamer2);

  if (!stream1 || !stream2) return;

  // 4. Viewers Join (Simulated by just knowing the ID, real join involves LiveKit)
  console.log('\n--- VIEWERS JOINING ---');
  // In a real app, they would connect to LiveKit. Here we simulate "presence" by sending gifts.

  // 5. Battle Matchmaking
  console.log('\n--- BATTLE MATCHMAKING ---');
  
  // Streamer 1 looks for match
  console.log('Streamer 1 finding match...');
  const { data: matchCandidates, error: matchError } = await streamer1.client.rpc('find_match_candidate', {
      p_stream_id: stream1.id
  });

  if (matchError) {
      console.error('Matchmaking error:', matchError);
  } else {
      console.log('Match candidates found:', matchCandidates ? matchCandidates.length : 0);
  }

  // Directly challenge Streamer 2 (since we know the ID and want to force it)
  console.log('Streamer 1 challenging Streamer 2...');
  const { data: challengeId, error: challengeError } = await streamer1.client.rpc('create_battle_challenge', {
      p_challenger_id: stream1.id,
      p_opponent_id: stream2.id // Assuming RPC takes stream ID, check schema
  });

  // Check RPC signature: create_battle_challenge(p_challenger_id UUID, p_opponent_id UUID)
  // The schema showed it takes stream IDs.

  if (challengeError) {
      console.error('Challenge error:', challengeError);
  } else {
      console.log('Challenge created. Battle ID (if returned):', challengeId);
  }

  // Find the pending battle
  const { data: pendingBattle } = await streamer2.client
      .from('battles')
      .select('*')
      .eq('opponent_stream_id', stream2.id)
      .eq('status', 'pending')
      .maybeSingle();

  if (!pendingBattle) {
      console.error('Streamer 2 could not find pending battle.');
  } else {
      console.log(`Streamer 2 found pending battle: ${pendingBattle.id}`);
      
      // Accept
      const { error: acceptError } = await streamer2.client.rpc('accept_battle', {
          p_battle_id: pendingBattle.id
      });

      if (acceptError) {
          console.error('Accept error:', acceptError);
      } else {
          console.log('Battle Accepted!');
      }
  }

  // 6. Battle Interaction (Gifts)
  console.log('\n--- BATTLE INTERACTION ---');
  
  // Viewer 1 gifts Streamer 1
  console.log('Viewer 1 sending gift to Streamer 1...');
  const { data: gift1, error: giftError1 } = await viewer1.client.rpc('send_gift_in_stream', {
      p_sender_id: viewer1.userId,
      p_receiver_id: streamer1.userId,
      p_stream_id: stream1.id,
      p_gift_id: gift.slug || gift.id,
      p_quantity: 1
  });

  if (giftError1) {
        console.error('Gift 1 failed (RPC Error):', giftError1);
    } else if (gift1 && !gift1.success) {
        console.error('Gift 1 failed (Logic Error):', gift1);
    } else {
        console.log('Gift 1 sent! Result:', gift1);
    }

    // Viewer 2 gifts Streamer 2
    console.log('Viewer 2 sending gift to Streamer 2...');
    const { data: gift2, error: giftError2 } = await viewer2.client.rpc('send_gift_in_stream', {
        p_sender_id: viewer2.userId,
        p_receiver_id: streamer2.userId,
        p_stream_id: stream2.id,
        p_gift_id: gift.slug || gift.id,
        p_quantity: 1
    });

    if (giftError2) {
        console.error('Gift 2 failed (RPC Error):', giftError2);
    } else if (gift2 && !gift2.success) {
        console.error('Gift 2 failed (Logic Error):', gift2);
    } else {
        console.log('Gift 2 sent! Result:', gift2);
    }

  // Viewer 3 follows Streamer 1
  console.log('Viewer 3 following Streamer 1...');
  const { error: followError } = await viewer3.client
      .from('user_follows')
      .insert({
          follower_id: viewer3.userId,
          following_id: streamer1.userId
      });
  
  if (followError) console.error('Follow failed:', followError);
  else console.log('Viewer 3 followed Streamer 1!');

  // Viewers Chatting
  console.log('Viewers sending chat messages...');
  const chatMsg = {
      stream_id: stream1.id,
      user_id: viewer1.userId,
      content: 'Hype in the chat! 🔥'
  };
  const { error: chatError } = await viewer1.client
      .from('stream_messages')
      .insert(chatMsg);

  if (chatError) console.error('Chat failed:', chatError);
  else console.log('Viewer 1 sent chat message!');

  // Check scores
  console.log('Checking battle scores...');
  const { data: battleState } = await streamer1.client
      .from('battles')
      .select('*')
      .or(`challenger_stream_id.eq.${stream1.id},opponent_stream_id.eq.${stream1.id}`)
      .eq('status', 'active')
      .single();

  if (battleState) {
      console.log('Battle State:', {
          id: battleState.id,
          score_challenger: battleState.score_challenger,
          score_opponent: battleState.score_opponent,
          pot_challenger: battleState.pot_challenger,
          pot_opponent: battleState.pot_opponent
      });

      // End Battle
      console.log('Streamer 1 ending battle...');
      const { error: endBattleError } = await streamer1.client.rpc('end_battle', {
          p_battle_id: battleState.id,
          p_winner_stream_id: null // Draw/Manual end
      });

      if (endBattleError) console.error('End Battle failed:', endBattleError);
      else console.log('Battle ended successfully via RPC.');
  } else {
      console.log('No active battle found (might have ended or not started).');
  }

  // 7. Cleanup
  console.log('\n--- CLEANUP ---');
  // End streams
  await streamer1.client.from('streams').update({ status: 'ended', is_live: false }).eq('id', stream1.id);
  await streamer2.client.from('streams').update({ status: 'ended', is_live: false }).eq('id', stream2.id);
  
  // If battle active, end it
  if (battleState) {
      await streamer1.client.from('battles').update({ status: 'ended', winner_id: streamer2.userId }).eq('id', battleState.id);
      console.log('Battle ended manually.');
  }

  console.log('--- TEST COMPLETE ---');
}

runTest().catch(console.error);
