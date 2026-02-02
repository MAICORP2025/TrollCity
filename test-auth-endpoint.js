const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY required');

const testAuthEndpoint = async () => {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email: 'test@example.com', password: 'test123', username: 'test' })
    });
    console.log('Response:', response.status);
    console.log(response.ok ? '✅ Working' : '❌ Error');
  } catch (error) {
    console.error('Error:', error);
  }
};

testAuthEndpoint();
