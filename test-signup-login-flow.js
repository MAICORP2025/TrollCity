const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZHl2aG5hbGptZG13emZib3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1OTYwOTIsImV4cCI6MjA3OTE3MjA5Mn0.C4FzFi9NQH0fzJ-w1MAm2pLrefx4B98uNrXi5EuA_8U';
const supabaseUrl = 'https://yjxpwfalenorzrqxwmtr.supabase.co';

const run = async () => {
    const randomId = Math.random().toString(36).substring(7);
    const email = `test${randomId}@example.com`;
    const password = `pass${randomId}`;
    const username = `user${randomId}`;

    console.log(`Testing with ${email} / ${password}`);

    // 1. Signup
    const signupRes = await fetch(`${supabaseUrl}/functions/v1/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({ email, password, username })
    });

    const signupData = await signupRes.json();
    console.log('Signup Result:', signupRes.status, signupData);

    if (!signupRes.ok) {
        console.error('Signup failed');
        return;
    }

    // 2. Login
    const loginRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey
        },
        body: JSON.stringify({ email, password })
    });

    const loginData = await loginRes.json();
    if (loginRes.ok && loginData.access_token) {
        console.log('✅ Login successful! Token received.');
    } else {
        console.error('❌ Login failed:', loginRes.status, loginData);
    }
}

run();
