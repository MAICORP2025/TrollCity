# 📜 Troll City Rules, Fees & Economy Summary
$1 is 150 coins not 100 coin packs must be the ones in the current coin store with $1.99 for 300 being the smallest so update that coin pack list, fix withdrawl limit
This document serves as a centralized reference for all financial constants, fees, platform rules, and economic mechanics found in the codebase.

---

## 💰 Financial Overview

### Coin Value
*   **Exchange Rate:** 100 Coins = $1.00 USD
*   **Currency:** `troll_coins` (Internal virtual currency)

### Coin Purchase Packages
| Package | Coins | Price (USD) | Cost per 1k Coins |
| :--- | :--- | :--- | :--- |
| **Bronze** | 1,000 | $4.49 | $4.49 |
| **Silver** | 5,000 | $20.99 | $4.20 |
| **Gold** | 12,000 | $49.99 | $4.17 |
| **Platinum** | 25,000 | $99.99 | $4.00 |
| **Diamond** | 60,000 | $239.99 | $4.00 |
| **Legendary** | 120,000 | $459.99 | $3.83 |

---

## 💸 Platform Fees & Commissions

### Transaction Fees
*   **Gift Commission:** 1% of the gift value goes to the platform.
*   **Paid Stream Seats:**
    *   **Admin/Platform Cut:** 5%
    *   **Host/Streamer Earnings:** 95%
*   **Marketplace Sales:**
    *   Platform fee is 5000 coins deducted each week from seller.
  

### Payout Fees (Real Money Cashout)
*   **Tax Compliance:** IRS Form 1099-K issued for earnings over $600/year.

---

## 🏦 User Earnings & Payout Rules

### Withdrawal Limits
*   **Minimum Payout:** 12,000 Coins (≈ $120.00 value, though one source mentioned ≈$36, the 150 coins = $1 rule implies 12,000 = $120. *Correction: If 100 coins = $1, then 12,000 coins = $120. If the code says 12,000 is ~$36, there may be a legacy rate or typo in the UI text, but 100:1 is the standard.*)
*   **Age Requirement:** Users must enable "18+ Age Restriction" to be eligible for payouts.

### Earning Mechanics
*   **Gifts:** Users earn coins when receiving virtual gifts during streams or on posts.
*   **Referrals:** Users can earn bonuses for referring new users (Recruiter Program).
*   **Daily Login:** Users can earn 0-100 coins once per day via the Daily Login Wall.
Landlords earn coins, users selling cars, properties earn coins, 
---

## 🚗 Game Economy & Item Costs

### Special Features
*   **Admin For A Week:** 50,000 Coins.
    *   Grants temporary admin privileges.No acess to admin dashboard or other role dashboards make temp changes non frontend or backend, kicks dont cost, bans must be officer approved, that needs to be implemented
    *   Queue-based system.

### Vehicles (Troll Motor Vehicle - TMV)
*   **Title Fee:** 500 Coins (Default).
*   **Registration Fee:** 200 Coins (Default).
*   **Purchase:** Full price or Loan (Down payment required).
*   **Insurance:** Policies are created as "unpaid" initially.

### Tournaments
*   **Entry Fee:** Configurable per tournament (e.g., 100 Coins).
*   **Prize Pools:** Text-based description (e.g., "500,000 Coins + Rare Badge").

\We dont have nor use a wheel of fortune
will bbring back troll wheel later 

---

## 👤 User-Defined Costs

Users can set their own prices for interactions:
*   **Message Cost:** Fee for other users to send a private message.
*   **Profile View Cost:** Fee for other users to view their full profile.
*   **Stream Seat Price:** Hosts can set a price for users to join their stream stage (Paid Seats). Viewers only view thru hls once then click on guest box even with or without seat price they then switch instantly to livekit 

---

## 📜 Platform Rules & Policies

### Broadcasting
*   **Prerequisites:**
    *   Must complete Onboarding.
    *   Must complete ID Verification.
    *   Must possess a **Broadcast Badge** (unless Admin). Given after 24 hour broadcast restriction period is over once the account was created, badge must be given and next to username.
*   **Restrictions:**
    *   **Global Lockdown:** Admins can pause all broadcasting.
    *   **Capacity Limit:** Default max 100 simultaneous broadcasters.
    *   **Content:** No misleading content (fake earnings, scams). Violation leads to instant court summon, suspension/ban.

### Daily Activities
*   **Daily Login:** Strictly limited to once per user per day (UTC reset).
*   **troll wall can be posted to unlimied times but 5 post per user within an hour unlimited comments,

### Family & Community
*   **Family Structure:** Includes Roles (Leader, Consort, etc.) and Contribution Points.
*   **Wars/Battles:** Families can engage in battles (e.g., "Troll City Showdown").

---

## 🛡️ Technical Limits & Security

### Rate Limiting
*   **API Limits:** Rate limits are enforced on critical endpoints (verified in flight checks).
*   **Idempotency:** Payment and spending functions use idempotency keys to prevent double-charging.

### Security
*   **Server-Side Crediting:** Coins are ONLY credited via secure server-side Edge Functions.
*   **Row Level Security (RLS):** Strict database policies prevent users from viewing or modifying unauthorized data.
*   **Audit Logging:** All coin movements are logged in `coin_transactions` and `admin_pool_ledger`.
