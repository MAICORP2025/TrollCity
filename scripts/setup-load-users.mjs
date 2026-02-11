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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const USERS_TO_CREATE = [
  { email: 'loadtest_streamer1@example.com', password: 'password123', role: 'broadcaster', username: 'StreamerOne' },
  { email: 'loadtest_streamer2@example.com', password: 'password123', role: 'broadcaster', username: 'StreamerTwo' },
  { email: 'loadtest_viewer1@example.com', password: 'password123', role: 'user', username: 'ViewerOne' },
  { email: 'loadtest_viewer2@example.com', password: 'password123', role: 'user', username: 'ViewerTwo' },
  { email: 'loadtest_viewer3@example.com', password: 'password123', role: 'user', username: 'ViewerThree' }
];

async function setupUsers() {
  console.log('--- Setting up Load Test Users ---');

  for (const user of USERS_TO_CREATE) {
    console.log(`Processing ${user.email}...`);

    // Check if user exists (by email) - admin API doesn't support getByEmail directly easily without listUsers, 
    // but we can try to create and catch error, or list users.
    // Actually, let's just try to delete them first to ensure clean state, or just create if not exists.
    // Deleting is safer for a clean slate but might break things if they have foreign keys.
    // Let's just create if not exists.

    // Using admin.listUsers to find if exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      continue;
    }

    const existingUser = users.find(u => u.email === user.email);
    let userId;

    if (existingUser) {
      console.log(`User ${user.email} already exists. ID: ${existingUser.id}`);
      userId = existingUser.id;
      // Update password just in case
      await supabase.auth.admin.updateUserById(userId, { password: user.password });
    } else {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
            username: user.username
        }
      });

      if (createError) {
        console.error(`Error creating user ${user.email}:`, createError);
        continue;
      }
      userId = newUser.user.id;
      console.log(`Created user ${user.email}. ID: ${userId}`);
    }

    // Now ensure profile exists and has coins
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching profile:', profileError);
    }

    if (!profile) {
        console.log('Creating profile...');
        await supabase.from('user_profiles').insert({
            id: userId,
            username: user.username,
            coins: 10000, // Give them plenty of coins
            role: 'user', // DB role column, usually 'user' or 'admin'
            is_broadcaster: user.role === 'broadcaster'
        });
    } else {
        console.log('Updating profile coins...');
        await supabase.from('user_profiles').update({
            coins: 10000,
            is_broadcaster: user.role === 'broadcaster',
            username: user.username
        }).eq('id', userId);
    }
  }

  console.log('--- Setup Complete ---');
}

setupUsers();
