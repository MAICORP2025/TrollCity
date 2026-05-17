import { chromium, FullConfig } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Create a test user in Supabase (requires service role key)
async function ensureTestUser(email: string, password: string, role: string = 'viewer', metadata?: any) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // secret key
  );

  // Check if user exists
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email)
    .single();

  let userId = existing?.id;

  if (!userId) {
    // Create Auth user via admin
    const { data: authData, error } = await supabase.admin.auth.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = authData.user.id;

    // Insert profile with role
    await supabase.from('user_profiles').insert({
      id: userId,
      username: email.split('@')[0],
      email,
      role,
      ...metadata,
    });
  } else {
    // Update role if needed
    await supabase
      .from('user_profiles')
      .update({ role, ...metadata })
      .eq('id', userId);
  }

  return userId;
}

async function globalSetup(config: FullConfig) {
  console.log('🌱 Seeding test users and streams for Playwright E2E...');

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

   // ── Seed test users ──
   const users = [
     { email: 'viewer.rich@test.troll', password: 'password123', role: 'viewer', metadata: { troll_coins: 500, account_state: 'normal' } },
     { email: 'viewer.poor@test.troll', password: 'password123', role: 'viewer', metadata: { troll_coins: 10, account_state: 'normal' } },
     { email: 'officer@test.troll', password: 'password123', role: 'troll_officer', metadata: { troll_coins: 1000, account_state: 'normal' } },
     { email: 'lead@test.troll', password: 'password123', role: 'lead_troll_officer', metadata: { troll_coins: 1000, account_state: 'normal' } },
     { email: 'jailed@test.troll', password: 'password123', role: 'viewer', metadata: { troll_coins: 50, live_restricted_until: new Date(Date.now() + 86400000 * 30).toISOString(), account_state: 'jailed' } },
     { email: 'broadcaster@test.troll', password: 'password123', role: 'broadcaster', metadata: { troll_coins: 5000, account_state: 'normal' } },
   ];

  for (const u of users) {
    try {
      await ensureTestUser(u.email, u.password, u.role, u.metadata);
      console.log(`✅ Seeded user: ${u.email}`);
    } catch (err: any) {
      console.warn(`⚠️ Failed to seed ${u.email}:`, err.message);
    }
  }

  // ── Seed broadcaster ID ──
  const { data: bcaster } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('role', 'broadcaster')
    .limit(1)
    .single();

  if (!bcaster?.id) {
    console.warn('⚠️ No broadcaster found — skipping stream seeding.');
    return;
  }

  const broadcasterId = bcaster.id;

  // ── Seed test streams ──
  const streams = [
    {
      id: 'seed-test-stream-1',
      title: 'General Test Stream',
      category: 'General Chat',
      box_count: 1,
      paid_chat_enabled: false,
    },
    {
      id: 'free-chat-stream',
      title: 'Free Chat Stream',
      category: 'General Chat',
      box_count: 1,
    },
    {
      id: 'paid-per-user-stream',
      title: 'Paid Per-User Stream',
      category: 'General Chat',
      box_count: 1,
      paid_chat_enabled: true,
      paid_chat_type: 'per_user',
      paid_chat_price: 50,
    },
    {
      id: 'paid-per-message-stream',
      title: 'Paid Per-Message Stream',
      category: 'General Chat',
      box_count: 1,
      paid_chat_enabled: true,
      paid_chat_type: 'per_chat',
      paid_chat_price: 10,
    },
    {
      id: 'battle-active-stream',
      title: 'Battle Stream',
      category: 'Battle',
      box_count: 2,
      is_battle: true,
      battle_mode: '1v1',
      battle_status: 'active',
    },
    {
      id: 'trolltoe-active-stream',
      title: 'Troll Toe Active Stream',
      category: 'General Chat',
      box_count: 1,
    },
  ];

  for (const s of streams) {
    try {
      await supabase.from('streams').upsert(
        {
          id: s.id,
          user_id: broadcasterId,
          title: s.title,
          category: s.category,
          box_count: s.box_count,
          status: 'live',
          is_live: true,
          created_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          // Optional paid chat fields (if table exists)
          ...(s.paid_chat_enabled !== undefined && { paid_chat_enabled: s.paid_chat_enabled }),
          ...(s.paid_chat_type && { paid_chat_type: s.paid_chat_type }),
          ...(s.paid_chat_price && { paid_chat_price: s.paid_chat_price }),
          // Battle fields
          ...(s.is_battle && { is_battle: true }),
          ...(s.battle_mode && { battle_mode: s.battle_mode }),
          ...(s.battle_status && { battle_status: s.battle_status }),
        },
        { onConflict: 'id' }
      );
      console.log(`✅ Seeded stream: ${s.id}`);

      // Seed stream_settings for paid chat streams
      if (s.paid_chat_enabled) {
        await supabase.from('stream_settings').upsert(
          {
            stream_id: s.id,
            paid_chat_enabled: true,
            paid_chat_type: s.paid_chat_type,
            paid_chat_price: s.paid_chat_price,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stream_id' }
        );
        console.log(`✅ Seeded stream_settings: ${s.id} (paid chat)`);
      }
    } catch (err: any) {
      console.warn(`⚠️ Failed to seed stream ${s.id}:`, err.message);
    }
  }

  console.log('🌱 Global setup complete.');
}

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Playwright teardown complete (keeping seeded data).');
}

export default globalSetup;
