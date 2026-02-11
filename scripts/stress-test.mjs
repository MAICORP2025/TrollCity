import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/livekit-token';
const SECRET_KEY = 'your-secret-load-test-key';
const CONCURRENT_REQUESTS = 100;

async function runStressTest() {
  console.log(`--- STARTING STRESS TEST (${CONCURRENT_REQUESTS} concurrent requests) ---`);

  const promises = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const promise = fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-load-test-secret': SECRET_KEY,
      },
      body: JSON.stringify({
        roomName: `load-test-room-${i}`,
        identity: `load-test-user-${i}`,
        role: 'broadcaster',
        allowPublish: true,
      }),
    });
    promises.push(promise);
  }

  const results = await Promise.all(promises);

  let successCount = 0;
  for (const res of results) {
    if (res.ok) {
      successCount++;
    }
  }

  console.log(`--- STRESS TEST COMPLETE ---`);
  console.log(`Success rate: ${successCount}/${CONCURRENT_REQUESTS}`);
}

runStressTest();
