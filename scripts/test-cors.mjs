import fetch from 'node-fetch';

const MAITALENT_URL = 'https://adjifwfblbdkypmeqiay.supabase.co/functions/v1/redeem-maitalent-promo';
const PROMO_SECRET = 'gj3f29QZx4vHn6A8r5S2pL1u9Jd0Yc7F';

async function test() {
  console.log('=== CORS Test for https://maitalent.fun ===\n');

  console.log('--- OPTIONS preflight ---');
  const opt = await fetch(MAITALENT_URL, {
    method: 'OPTIONS',
    headers: {
      'Origin': 'https://maitalent.fun',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type,x-api-key'
    }
  });
  console.log('OPTIONS Status:', opt.status);
  console.log('Access-Control-Allow-Origin:', opt.headers.get('access-control-allow-origin'));
  console.log('Access-Control-Allow-Credentials:', opt.headers.get('access-control-allow-credentials'));
  console.log('Access-Control-Allow-Methods:', opt.headers.get('access-control-allow-methods'));
  console.log('Access-Control-Allow-Headers:', opt.headers.get('access-control-allow-headers'));

  console.log('\n--- POST with x-api-key only ---');
  const postApiKey = await fetch(MAITALENT_URL, {
    method: 'POST',
    headers: {
      'Origin': 'https://maitalent.fun',
      'Content-Type': 'application/json',
      'x-api-key': PROMO_SECRET
    },
    body: JSON.stringify({ code: 'TEST' })
  });
  console.log('POST Status:', postApiKey.status);
  console.log('Access-Control-Allow-Origin:', postApiKey.headers.get('access-control-allow-origin'));
  console.log('Access-Control-Allow-Credentials:', postApiKey.headers.get('access-control-allow-credentials'));
  console.log('Body:', await postApiKey.text());
}

test().catch(console.error);