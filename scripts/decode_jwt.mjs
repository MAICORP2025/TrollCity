import dotenv from 'dotenv';
dotenv.config();

const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.log('No SERVICE_ROLE_KEY found');
  process.exit(1);
}

try {
  const payload = JSON.parse(atob(key.split('.')[1]));
  console.log('JWT Payload:', payload);
  console.log('Project Ref (from iss):', payload.iss);
} catch (e) {
  console.error('Failed to decode:', e.message);
}
