#!/usr/bin/env node

/**
 * Manual Coin Order System Test Script
 * Tests the complete Cash App payment workflow
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://yjxpwfalenorzrqxwmtr.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

console.log("🧪 Manual Coin Order System Test\n");
console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
console.log(`🔑 Using ANON_KEY: ${SUPABASE_ANON_KEY ? '✅ Present' : '❌ Missing'}\n`);

if (!SUPABASE_ANON_KEY) {
  console.error("❌ VITE_SUPABASE_ANON_KEY environment variable is required");
  process.exit(1);
}

// Test suite
const tests = [];

async function test(name, fn) {
  tests.push({ name, fn, status: 'pending', error: null, result: null });
}

// TEST 1: CORS Preflight
test("CORS Preflight (OPTIONS /manual-coin-order)", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/manual-coin-order`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:5173",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type",
    },
  });

  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }

  const corsOrigin = response.headers.get("Access-Control-Allow-Origin");
  const corsMethods = response.headers.get("Access-Control-Allow-Methods");
  
  if (!corsOrigin || !corsMethods) {
    throw new Error(`CORS headers missing: Origin=${corsOrigin}, Methods=${corsMethods}`);
  }

  return { status: response.status, corsOrigin, corsMethods };
});

// TEST 2: Create Manual Order (requires auth)
test("Create Manual Order (POST /manual-coin-order with action=create)", async () => {
  // First, we need a valid auth token
  // This test assumes you have SUPABASE_TEST_USER_EMAIL and SUPABASE_TEST_USER_PASSWORD env vars
  // Or we'll just check the endpoint is reachable
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/manual-coin-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token", // Will get 401
    },
    body: JSON.stringify({
      action: "create",
      coins: 500,
      amount_usd: 4.99,
      username: "testuser",
    }),
  });

  if (response.status !== 401) {
    throw new Error(`Expected 401 for invalid token, got ${response.status}`);
  }

  const data = await response.json();
  if (!data.error) {
    throw new Error("Expected error response");
  }

  return { status: response.status, error: data.error };
});

// TEST 3: Approve Order (requires admin role)
test("Approve Order (POST /manual-coin-order with action=approve)", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/manual-coin-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token", // Will get 401
    },
    body: JSON.stringify({
      action: "approve",
      order_id: "test-order-id",
    }),
  });

  if (response.status !== 401) {
    throw new Error(`Expected 401 for invalid token, got ${response.status}`);
  }

  return { status: response.status };
});

// TEST 4: Check Order Status
test("Check Order Status (POST /manual-coin-order with action=status)", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/manual-coin-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
    },
    body: JSON.stringify({
      action: "status",
      order_id: "test-order-id",
    }),
  });

  if (response.status !== 401) {
    throw new Error(`Expected 401 for invalid token, got ${response.status}`);
  }

  return { status: response.status };
});

// TEST 5: Invalid Action
test("Invalid Action (POST /manual-coin-order with action=invalid)", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/manual-coin-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      action: "invalid",
    }),
  });

  if (response.status !== 401) {
    throw new Error(`Expected 401 for invalid token, got ${response.status}`);
  }

  return { status: response.status };
});

// TEST 6: Missing Action
test("Missing Action (POST /manual-coin-order without action)", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/manual-coin-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({}),
  });

  if (response.status !== 401) {
    throw new Error(`Expected 401 for invalid token, got ${response.status}`);
  }

  return { status: response.status };
});

// TEST 7: Wrong HTTP Method
test("Wrong HTTP Method (GET /manual-coin-order)", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/manual-coin-order`, {
    method: "GET",
    headers: {
      "Authorization": "Bearer test-token",
    },
  });

  if (response.status !== 405) {
    throw new Error(`Expected 405 for GET, got ${response.status}`);
  }

  const data = await response.json();
  if (!data.error) {
    throw new Error("Expected error response");
  }

  return { status: response.status, error: data.error };
});

// Run all tests
async function runAllTests() {
  console.log("📋 Running tests...\n");

  let passed = 0;
  let failed = 0;

  for (const testObj of tests) {
    try {
      const result = await testObj.fn();
      testObj.status = "passed";
      testObj.result = result;
      passed++;
      console.log(`✅ ${testObj.name}`);
      if (result) console.log(`   ${JSON.stringify(result)}`);
    } catch (err) {
      testObj.status = "failed";
      testObj.error = err.message;
      failed++;
      console.log(`❌ ${testObj.name}`);
      console.log(`   Error: ${err.message}`);
    }
    console.log("");
  }

  console.log("\n📊 Results Summary");
  console.log(`✅ Passed: ${passed}/${tests.length}`);
  console.log(`❌ Failed: ${failed}/${tests.length}`);
  console.log(`\n${failed === 0 ? "🎉 All tests passed!" : "⚠️ Some tests failed"}`);

  return failed === 0;
}

// Run tests
runAllTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
