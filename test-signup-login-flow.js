const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY required');

const run = async () => {
  const randomId = Math.random().toString(36).substring(7);
  const email = `test${randomId}@example.com`;
  const password = `pass${randomId}`;

  const signupRes = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password, username: `user${randomId}` })
  });
  console.log('Signup:', signupRes.status);

  if (!signupRes.ok) return;

  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password })
  });

  console.log(loginRes.ok ? '✅ Login OK' : '❌ Login failed');
}

run();
