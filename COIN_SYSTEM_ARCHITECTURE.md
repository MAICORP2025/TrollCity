# PayPal Coin System - Architecture Overview

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TrollCity Frontend                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  CoinStoreProd.tsx Component                              │  │
│  │  ✓ PayPal Checkout Button                                 │  │
│  │  ✓ 6 Coin Package Selection                               │  │
│  │  ✓ Success/Error/Processing States                        │  │
│  │  ✓ Real-time Balance Display                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         ↓ (JWT Token)
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Functions                       │
│                   (Node.js + TypeScript)                         │
│                                                                   │
│  ┌──────────────────────┐    ┌──────────────────────┐            │
│  │ paypal-create-order  │    │ paypal-capture-order │            │
│  ├──────────────────────┤    ├──────────────────────┤            │
│  │ 1. Validate user     │    │ 1. Get PayPal token  │            │
│  │ 2. Check package     │    │ 2. Capture order     │            │
│  │ 3. Get token         │    │ 3. Validate status   │            │
│  │ 4. Create order      │    │ 4. Check duplicates  │            │
│  │ 5. Return orderId    │    │ 5. Record tx         │            │
│  │                      │    │ 6. Credit coins      │            │
│  │                      │    │ 7. Return success    │            │
│  └──────────────────────┘    └──────────────────────┘            │
│                                                                   │
│  Environment Variables:                                          │
│  • PAYPAL_CLIENT_ID (secret - never to frontend)                │
│  • PAYPAL_CLIENT_SECRET (secret - never to frontend)            │
│  • PAYPAL_ENV (sandbox or live)                                 │
└─────────────────────────────────────────────────────────────────┘
         ↓                              ↓
    (OAuth)                        (REST API)
         ↓                              ↓
┌──────────────────────────────────────────┐
│          PayPal API Service              │
│  ✓ /v1/oauth2/token (get access token)   │
│  ✓ /v2/checkout/orders (create order)    │
│  ✓ /v2/checkout/orders/{id} (get status) │
│  ✓ /v2/checkout/orders/{id}/capture      │
└──────────────────────────────────────────┘
         ↓ (User Payment)
    PayPal Website
         ↓ (Return to App with orderId)
         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ coin_packages                                           │   │
│  │ ├─ id (UUID)                                            │   │
│  │ ├─ name, coins, price_usd, paypal_sku                  │   │
│  │ └─ 6 rows (Bronze → Legendary)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ coin_transactions (Audit Trail)                         │   │
│  │ ├─ user_id, coins_granted, amount_usd                  │   │
│  │ ├─ paypal_order_id (UNIQUE)                            │   │
│  │ ├─ paypal_capture_id (UNIQUE) ← FRAUD PREVENTION       │   │
│  │ ├─ paypal_status (COMPLETED)                           │   │
│  │ └─ created_at (timestamp)                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ user_profiles                                           │   │
│  │ ├─ id, email, username                                 │   │
│  │ ├─ troll_coins (total coins)                           │   │
│  │ ├─ paid_coins (purchased coins only)                   │   │
│  │ └─ ... other fields                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  RLS Policies:                                                   │
│  ✓ Users read only own transactions                             │
│  ✓ Coins insert via service role only                           │
│  ✓ Packages public read                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Transaction Flow

```
Step 1: USER SELECTS PACKAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User: Clicks "Buy 5,000 coins for $20.99"
App: Shows PayPal checkout button


Step 2: CREATE ORDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frontend: POST /paypal-create-order
          Body: { packageId: "coins_5000" }
          Header: Authorization: Bearer JWT_TOKEN

Edge Function:
  ✓ Validates JWT token
  ✓ Queries coin_packages for price
  ✓ Gets PayPal access token
  ✓ Creates PayPal order ($20.99)
  ✓ Returns orderId: "9DW12345ABC"

Frontend: Stores orderId, shows PayPal button


Step 3: USER APPROVES IN PAYPAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User: Clicks PayPal button
User: (Redirected to PayPal website)
User: Logs in with PayPal account
User: Reviews order ($20.99)
User: Clicks "Pay Now"
PayPal: Approves payment
PayPal: Redirects back to app


Step 4: CAPTURE PAYMENT & CREDIT COINS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frontend: POST /paypal-capture-order
          Body: { orderId: "9DW12345ABC" }
          Header: Authorization: Bearer JWT_TOKEN

Edge Function: ⚠️ CRITICAL SECURITY CHECKS
  ✓ Validates JWT token
  ✓ Gets PayPal access token
  ✓ Calls PayPal API to capture $20.99
  ✓ Validates PayPal status = "COMPLETED"
  ✓ Checks if capture_id already processed (prevents replay)
  ✓ Inserts into coin_transactions table
  ✓ Updates user_profiles.paid_coins += 5000
  ✓ Updates user_profiles.troll_coins += 5000
  ✓ Returns { success: true, coinsAdded: 5000, newBalance: ... }

Database:
  INSERT coin_transactions {
    user_id: "abc123",
    coins_granted: 5000,
    amount_usd: 20.99,
    paypal_order_id: "9DW12345ABC",
    paypal_capture_id: "1A234567K"
  }
  
  UPDATE user_profiles SET
    paid_coins = paid_coins + 5000,
    troll_coins = troll_coins + 5000


Step 5: FRONTEND CONFIRMS
━━━━━━━━━━━━━━━━━━━━━━━
Frontend:
  ✓ Verifies success = true
  ✓ Updates UI: "+5000 coins credited!"
  ✓ Refreshes profile from database
  ✓ Shows new balance

User: Sees confirmation toast with new balance
```

---

## 🔐 Security Layers

### Layer 1: Authentication
```
Every API call must include JWT token
  Authorization: Bearer JWT_TOKEN
  ↓
Edge function validates token
  ↓
If invalid: Return 401 Unauthorized
If valid: Continue to Layer 2
```

### Layer 2: Authorization
```
Edge function verifies user owns the transaction
  - User ID from JWT matches transaction
  - User is requesting their own purchase
  ↓
If unauthorized: Return 403 Forbidden
If authorized: Continue to Layer 3
```

### Layer 3: PayPal Verification
```
Edge function gets PayPal access token using SECRET
  - Only edge function has PAYPAL_CLIENT_SECRET
  - Frontend only has PAYPAL_CLIENT_ID (public)
  ↓
Calls PayPal API to verify payment
  - Confirms status = "COMPLETED"
  - Confirms amount matches package price
  ↓
If payment not verified: Return error
If verified: Continue to Layer 4
```

### Layer 4: Replay Attack Prevention
```
Check if capture_id already processed
  ↓
SELECT * FROM coin_transactions 
  WHERE paypal_capture_id = "1A234567K"
  ↓
If exists: Return "Already processed"
If not: Continue to Layer 5
```

### Layer 5: Atomic Database Transaction
```
BEGIN TRANSACTION
  INSERT into coin_transactions (validated data)
  UPDATE user_profiles SET troll_coins = ...
  UPDATE user_profiles SET paid_coins = ...
COMMIT
  ↓
If any INSERT/UPDATE fails: ROLLBACK (no coins credited)
If all succeed: COMMIT (coins credited)
```

### Layer 6: RLS Policies
```
Even if someone hacks database directly:
  - Cannot read other users' transactions
  - Cannot insert transactions for other users
  - Cannot directly update coin amounts
  (Only service role can via edge functions)
```

---

## 📊 Data Model

### coin_packages
```
id              UUID              Primary Key
name            TEXT              "Bronze Pack", "Silver Pack", etc.
coins           INTEGER           1000, 5000, 12000, 25000, 60000, 120000
price_usd       NUMERIC(10,2)     4.49, 20.99, 49.99, etc.
paypal_sku      TEXT UNIQUE       "coins_1000", "coins_5000", etc.
is_active       BOOLEAN           TRUE or FALSE (for disabling packages)
created_at      TIMESTAMP         Auto-generated
updated_at      TIMESTAMP         Auto-generated
```

### coin_transactions
```
id                    UUID              Primary Key
user_id               UUID              Foreign Key → auth.users
package_id            UUID              Foreign Key → coin_packages
paypal_order_id       TEXT UNIQUE       "9DW12345ABC" (from PayPal)
paypal_capture_id     TEXT UNIQUE       "1A234567K" (from PayPal) ← FRAUD PREVENTION
paypal_status         TEXT              "COMPLETED" only
amount_usd            NUMERIC(10,2)     20.99
coins_granted         INTEGER           5000
created_at            TIMESTAMP         Auto-generated

Indexes:
- idx_coin_transactions_user_id
- idx_coin_transactions_paypal_order_id
- idx_coin_transactions_paypal_capture_id
```

### user_profiles (extended)
```
... existing fields ...
troll_coins           INTEGER           Total coins (free + paid)
paid_coins            INTEGER           Coins from purchases only
... more fields ...
```

---

## 💳 Payment Flow Diagram

```
User App                 PayPal Checkout              TrollCity Backend
  │                            │                            │
  ├─ Select Package ─────────────────────────────────────────┤
  │                            │                             │
  ├─ Create Order API ─────────────────────────────────────→ │
  │                            │                             │
  │                            │ Get Token + Create Order    │
  │                            ←─ PayPal API ──────────────→ │
  │                            │                             │
  │ ← orderId ─────────────────┼─────────────────────────────┤
  │                            │                             │
  ├─ Open PayPal Checkout ────→ │                             │
  │                            │                             │
  │                            ├─ User Approves             │
  │                            │  (Redirect back with       │
  │                            │   orderId in URL)          │
  │                            │                             │
  │ ← Resume with orderId ─────┤                             │
  │                            │                             │
  ├─ Capture Order API ───────────────────────────────────→ │
  │  (with orderId)            │                             │
  │                            │                             │
  │                            │ Get Token + Capture        │
  │                            │ + Verify + Credit Coins    │
  │                            ←─ PayPal API ──────────────→ │
  │                            │                             │
  │                            │ INSERT transaction         │
  │                            │ UPDATE coin balance        │
  │                            │ ← Database ──────────────→ │
  │                            │                             │
  │ ← Success + Coins Added ───┼─────────────────────────────┤
  │                            │                             │
  ├─ Show "+5000 coins!" ─────────────────────────────────────┤
  │                            │                             │
  └─ Refresh Profile ────────────────────────────────────────→ │
                               │                             │
                               │ ← New Balance ─────────────→ │
                               │                             │
```

---

## 📁 File Structure

```
trollcity-1/
├── supabase/
│   ├── migrations/
│   │   └── 20260109_coin_system.sql         ← Database schema
│   └── functions/
│       ├── paypal-create-order/
│       │   └── index.ts                     ← Create PayPal order
│       └── paypal-capture-order/
│           └── index.ts                     ← Capture & credit coins
│
├── src/
│   ├── pages/
│   │   └── CoinStoreProd.tsx                ← React UI component
│   └── ...
│
├── COIN_SYSTEM_SETUP.md                     ← Full setup guide
├── COIN_SYSTEM_QUICK_REF.md                 ← Quick reference
├── COIN_SYSTEM_DELIVERY.md                  ← This delivery summary
└── COIN_SYSTEM_ARCHITECTURE.md              ← Architecture overview (this file)
```

---

## ✅ Production Checklist

### Before Going Live

- [ ] PayPal credentials configured in Supabase
- [ ] Database migration applied successfully
- [ ] Edge functions deployed and tested
- [ ] Frontend component integrated
- [ ] .env.local configured with PayPal client ID
- [ ] Tested end-to-end with sandbox
- [ ] Monitored edge function logs for errors
- [ ] Verified coins credited to correct users
- [ ] Checked coin_transactions table for audit trail
- [ ] Set up monitoring/alerts
- [ ] Documented admin procedures
- [ ] Tested with live PayPal (optional before full launch)

### After Going Live

- [ ] Monitor edge function logs daily
- [ ] Check coin_transactions for any anomalies
- [ ] Verify PayPal account receiving funds
- [ ] Alert on any failed captures
- [ ] Weekly revenue reports
- [ ] Monitor for duplicate transactions (should be 0)

---

## 🎯 Key Metrics to Track

```
Daily Metrics:
  - Transaction count
  - Revenue ($)
  - Coins sold
  - Average transaction value
  - Failed captures (should be near 0)
  - Duplicate attempts (should be 0)

User Metrics:
  - New buyers
  - Repeat buyers (% buying again)
  - Average coins per user
  - Total lifetime value per user

Package Metrics:
  - Which packages are most popular?
  - Which have highest conversion?
  - Which generate most revenue?
```

---

**Architecture Version**: 1.0  
**Status**: Production-Ready ✅  
**Last Updated**: January 9, 2026
