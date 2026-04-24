import dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

async function runFix() {
  const url = `${SUPABASE_URL}/functions/v1/auth/admin-create-user`
  console.log('Triggering fix at:', url)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        email: 'fix_trigger_v3@example.com',
        password: 'TempPassword123!',
        username: 'fix_trigger_v3',
        force_fix: true
      })
    })

    const text = await res.text()
    console.log('Response status:', res.status)
    console.log('Response body:', text)

    if (res.ok) {
      console.log('✅ Fix triggered successfully! The migration should be applied.')
    } else {
      console.error('❌ Failed to trigger fix.')
    }

  } catch (e) {
    console.error('Error:', e)
  }
}

runFix()
