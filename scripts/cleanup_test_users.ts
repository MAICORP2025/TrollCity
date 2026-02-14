import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const emails = [
  'admin@test.com',
  'secretary@test.com',
  'lead.troll@test.com',
  'officer@test.com',
  'user@test.com',
];

async function getUserIdByEmail(email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200, page: 1 });
  if (error) throw error;

  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id || null;
}

async function cleanupUser(email: string) {
  const userId = await getUserIdByEmail(email);
  if (!userId) {
    console.log(`Skip ${email}: user not found`);
    return;
  }

  await supabase.from('user_tax_info').delete().eq('user_id', userId);
  await supabase.from('user_profiles').delete().eq('id', userId);
  await supabase.auth.admin.deleteUser(userId);
  console.log(`Deleted ${email} (${userId})`);
}

async function main() {
  for (const email of emails) {
    await cleanupUser(email);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
