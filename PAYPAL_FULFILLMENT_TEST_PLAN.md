# PayPal Fulfillment Test Plan

This document outlines the test cases for verifying the centralized PayPal purchase fulfillment system.

## Test Environment Setup

Before running tests, ensure:
1. Supabase migration `20260109_create_payment_logs.sql` has been applied
2. Edge Function `fulfill-paypal-purchase` has been deployed
3. Environment variables are configured in Supabase:
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `PAYPAL_MODE` (sandbox or live)
4. Test users exist with valid PayPal sandbox accounts

---

## Test Case 1: ✅ Successful Purchase

**Objective**: Verify that a successful PayPal payment correctly credits coins and updates all dashboards.

### Preconditions:
- Test user has 0 coins
- `coin_packages` table has active packages
- `payment_logs` table is empty for this order

### Test Steps:
1. User selects a coin package (e.g., Gold Pack - 12000 coins for $49.99)
2. User completes PayPal checkout in sandbox
3. PayPal approval triggers `onApprove` handler
4. `fulfill-paypal-purchase` Edge Function is called

### Expected Results:
| Check | Expected Value |
|-------|----------------|
| HTTP Response | 200 OK |
| `success` | `true` |
| `coinsAdded` | 12000 |
| `usdAmount` | 49.99 |
| User profile `troll_coins` | Increased by 12000 |
| `payment_logs` record | status = "COMPLETED" |
| `coin_transactions` record | Created with correct amounts |
| `platform_revenue` | Updated with +$49.99 |
| `platform_profit` | Updated with +$4.99 (10% fee) |

### Verification Queries:
```sql
-- Check payment log
SELECT * FROM payment_logs WHERE paypal_order_id = 'YOUR_ORDER_ID';

-- Check user coins
SELECT id, troll_coins FROM user_profiles WHERE id = 'USER_ID';

-- Check transaction
SELECT * FROM coin_transactions WHERE paypal_order_id = 'YOUR_ORDER_ID';

-- Check revenue dashboard
SELECT * FROM platform_revenue WHERE date = CURRENT_DATE;
```

---

## Test Case 2: ❌ Missing custom_id (User ID)

**Objective**: Verify the system handles PayPal orders without custom_id metadata.

### Preconditions:
- custom_id is not sent in PayPal order creation

### Test Steps:
1. Create PayPal order with empty custom_id
2. Complete payment
3. Call `fulfill-paypal-purchase` with orderId

### Expected Results:
| Check | Expected Value |
|-------|----------------|
| HTTP Response | 400 Bad Request |
| `success` | `false` |
| `errorCode` | `"MISSING_USER_ID"` |
| `requiresManualIntervention` | `true` |
| `payment_logs` record | status = "FAILED", error_code = "MISSING_USER_ID" |
| User coins | Unchanged (0) |

### Expected User Message:
"Order ID missing - PayPal integration incomplete"

---

## Test Case 3: 🔄 Duplicate Capture (Idempotency)

**Objective**: Verify that processing the same PayPal order twice doesn't credit coins twice.

### Preconditions:
- First successful purchase completed
- `payment_logs` has record with status "COMPLETED"

### Test Steps:
1. Call `fulfill-paypal-purchase` with the same orderId from Test Case 1

### Expected Results:
| Check | Expected Value |
|-------|----------------|
| HTTP Response | 200 OK |
| `success` | `true` |
| `coinsAdded` | 0 (no new coins) |
| `payment_logs` | Existing record unchanged |
| User coins | Same as after Test Case 1 |

### Verification Query:
```sql
SELECT COUNT(*) FROM payment_logs WHERE paypal_order_id = 'YOUR_ORDER_ID';
-- Should return 1 (not 2)
```

---

## Test Case 4: 💥 PayPal Completed but DB Write Fails

**Objective**: Verify error handling when PayPal payment succeeds but database operations fail.

### Preconditions:
- PayPal capture succeeds
- Database operations fail (e.g., RLS policy blocks update)

### Test Steps:
1. Complete PayPal payment
2. Simulate DB failure (e.g., disable INSERT permission)
3. Call `fulfill-paypal-purchase`

### Expected Results:
| Check | Expected Value |
|-------|----------------|
| HTTP Response | 202 Accepted (partial success) |
| `success` | `false` |
| `requiresManualIntervention` | `true` |
| `errorCode` | `"COIN_CREDIT_FAILED"` |
| `payment_logs` record | status = "FAILED", error_code = "COIN_CREDIT_FAILED" |
| Error logged | Full PayPal response stored in `raw_response` |

### Expected User Message:
"Payment completed but coins are delayed. Support has been notified."

### Admin Action Required:
```sql
-- Manual coin credit for affected user
UPDATE user_profiles 
SET troll_coins = troll_coins + 12000 
WHERE id = 'USER_ID';

-- Update log status
UPDATE payment_logs 
SET status = 'COMPLETED', completed_at = NOW() 
WHERE paypal_order_id = 'YOUR_ORDER_ID';
```

---

## Test Case 5: 🔒 RLS Prevents Client Writes

**Objective**: Verify that Row Level Security prevents unauthorized database modifications.

### Preconditions:
- Test user is not an admin
- RLS policies are active on `payment_logs`, `platform_revenue`, `platform_profit`

### Test Steps:
1. Regular user attempts to call `fulfill-paypal-purchase` via direct API
2. Check if unauthorized writes are blocked

### Expected Results:
| Check | Expected Value |
|-------|----------------|
| RLS blocks direct table writes | ✅ Blocked |
| Edge Function with service_role | ✅ Can write |
| Regular user via client SDK | ❌ Blocked |

### Verification:
```sql
-- Attempt as regular user (should fail)
INSERT INTO payment_logs (paypal_order_id, status, amount_usd) 
VALUES ('test-order', 'PENDING', 10.00);

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'payment_logs';
```

---

## Test Case 6: 💱 Amount Mismatch Validation

**Objective**: Verify the system rejects payments where amount doesn't match package price.

### Preconditions:
- Package price is $49.99
- Malicious actor manipulates PayPal to pay $1.00

### Test Steps:
1. Create PayPal order for $1.00 (different from $49.99 package price)
2. Call `fulfill-paypal-purchase` with packageId

### Expected Results:
| Check | Expected Value |
|-------|----------------|
| HTTP Response | 400 Bad Request |
| `success` | `false` |
| `errorCode` | `"AMOUNT_MISMATCH"` |
| `requiresManualIntervention` | `true` |
| `payment_logs` record | status = "FAILED", error_code = "AMOUNT_MISMATCH" |

### Expected Error Message:
"Amount mismatch: paid $1.00, package priced at $49.99"

---

## Test Case 7: 🌐 Currency Validation

**Objective**: Verify the system only accepts USD payments.

### Preconditions:
- PayPal account configured for non-USD currency

### Test Steps:
1. Create PayPal order with EUR currency
2. Call `fulfill-paypal-purchase`

### Expected Results:
| Check | Expected Value |
|-------|----------------|
| HTTP Response | 400 Bad Request |
| `success` | `false` |
| `errorCode` | `"INVALID_CURRENCY"` |
| `payment_logs` record | status = "FAILED", error_code = "INVALID_CURRENCY" |

---

## Test Case 8: 📊 Dashboard Updates Verification

**Objective**: Verify platform revenue and profit totals update correctly.

### Preconditions:
- `platform_revenue` and `platform_profit` tables exist
- Before test: note current daily totals

### Test Steps:
1. Complete 3 purchases of different amounts
2. Check dashboard totals

### Expected Results:
| Purchase | Amount | Revenue Added | Profit Added (10%) |
|----------|--------|---------------|-------------------|
| Bronze | $4.49 | +$4.49 | +$0.45 |
| Gold | $49.99 | +$49.99 | +$5.00 |
| Platinum | $99.99 | +$99.99 | +$10.00 |
| **Total** | $154.47 | +$154.47 | +$15.45 |

### Verification Query:
```sql
SELECT * FROM platform_revenue WHERE date = CURRENT_DATE;
SELECT * FROM platform_profit WHERE date = CURRENT_DATE;
```

---

## Test Case 9: 📋 Transaction Logging Completeness

**Objective**: Verify all transaction data is logged for audit purposes.

### Preconditions:
- Successful purchase completed

### Test Steps:
1. Query all related tables for the purchase
2. Verify data consistency

### Expected Results:
All tables should have matching data:
```sql
-- payment_logs
SELECT paypal_order_id, paypal_capture_id, user_id, package_id, 
       status, amount_usd, coins_granted, error_code, error_message
FROM payment_logs 
WHERE paypal_order_id = 'YOUR_ORDER_ID';

-- coin_transactions
SELECT user_id, paypal_order_id, paypal_capture_id, amount_usd, coins_granted
FROM coin_transactions 
WHERE paypal_order_id = 'YOUR_ORDER_ID';

-- user_profiles (before and after)
SELECT id, troll_coins FROM user_profiles WHERE id = 'USER_ID';
```

### Audit Trail Fields:
| Field | Purpose |
|-------|---------|
| `paypal_order_id` | Primary idempotency key |
| `paypal_capture_id` | Secondary idempotency key |
| `raw_response` | Full PayPal API response for debugging |
| `metadata` | Payer email, payment method, order status |
| `created_at` / `updated_at` | Timestamp tracking |

---

## Test Case 10: 🔄 Edge Function Re-deployment

**Objective**: Verify the system works after Edge Function updates.

### Test Steps:
1. Deploy new version of `fulfill-paypal-purchase`
2. Complete a purchase
3. Verify all functionality works

### Expected Results:
- Function deploys successfully
- Purchase flow completes without errors
- All logging and dashboard updates work

---

## Automated Test Script

```javascript
// Test script for PayPal fulfillment
async function runTests() {
  const tests = [
    { name: 'Successful Purchase', test: testSuccessfulPurchase },
    { name: 'Duplicate Capture', test: testDuplicateCapture },
    { name: 'Missing User ID', test: testMissingUserId },
    { name: 'Amount Mismatch', test: testAmountMismatch },
  ];
  
  for (const { name, test } of tests) {
    console.log(`\n🧪 Running: ${name}`);
    try {
      await test();
      console.log(`✅ ${name} PASSED`);
    } catch (error) {
      console.log(`❌ ${name} FAILED:`, error.message);
    }
  }
}

// Run tests
runTests();
```

---

## Test Data Setup

```sql
-- Seed test packages
INSERT INTO coin_packages (name, coins, price_usd, paypal_sku, is_active)
VALUES 
  ('Test Bronze', 1000, 4.49, 'test_coins_1000', true),
  ('Test Gold', 12000, 49.99, 'test_coins_12000', true);

-- Create test user
INSERT INTO user_profiles (id, username, troll_coins)
VALUES ('test-user-uuid', 'testuser', 0);

-- Clear test data
DELETE FROM payment_logs WHERE paypal_order_id LIKE 'test-%';
DELETE FROM coin_transactions WHERE paypal_order_id LIKE 'test-%';
```

---

## Success Criteria Summary

| Metric | Target |
|--------|--------|
| Purchase success rate | > 99% |
| Duplicate credit rate | 0% |
| Error logging coverage | 100% of failures |
| Dashboard sync delay | < 5 seconds |
| Idempotency enforcement | 100% |

---

## Reporting Issues

If tests fail, capture:
1. Full error message and stack trace
2. PayPal order ID and capture ID
3. `payment_logs` record contents
4. Network request/response payloads

Report to: #dev-support channel
