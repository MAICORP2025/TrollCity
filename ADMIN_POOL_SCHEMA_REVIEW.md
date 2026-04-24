# Admin Pool + Ledger System: Schema Review & Design

## 1. Existing Structures (Reused Unchanged)

We have identified the following core tables that will be **preserved without modification**:

*   **`user_profiles`**: Stores user identity and balances.
    *   `Troll_coins` (Paid): Purchased coins (Spendable).
    *   `troll_coins` (Free): Gameplay/Gifted coins (Spendable).
    *   *Note: We will add a new column `earned_balance` to track cashout eligibility safely.*
*   **`coin_transactions`**: The primary ledger for user coin history.
    *   Used for: `purchase`, `gift`, `spend`, etc.
    *   *Status: Reused as the user-facing history.*
*   **`payout_requests`**: Tracks user cashout requests.
    *   *Status: Reused and linked to new ledger entries.*
*   **`admin_pool_transactions`**: Existing table for cashout-specific admin tracking.
    *   *Status: Will be superseded/complemented by the more comprehensive `admin_pool_ledger`.*
*   **`gifts` / `gift_sends`**: Defines gifts and tracks sending history.
    *   *Status: Reused.*

## 2. Proposed Extensions (Backward Compatible)

To meet the "Atomic" and "Accurate Liability" requirements, we will add:

### A. New Columns on `user_profiles`
*   `earned_balance` (BigInt, Default 0):
    *   **Purpose**: Explicitly tracks coins earned from others (Gifts) that are eligible for cashout.
    *   **Logic**: `Cashable Amount = MIN(troll_coins, earned_balance)`. This ensures users cannot cash out coins they have already spent, while also preventing "Paid" coins from being cashed out.

### B. `admin_pool` Table (System Wallet)
*   If missing, we create it. If existing, we ensure these columns:
    *   `total_liability_coins`: Total `earned_balance` across all users.
    *   `total_liability_usd`: Current USD value of that liability (snapshot).
    *   `total_paid_usd`: Total USD successfully cashed out.
    *   `trollcoins_balance`: (Existing) System fee accumulation.

### C. `admin_pool_ledger` (Immutable Audit Trail)
*   Tracks *every* event that changes the Admin Pool liability.
*   **Events**:
    *   `GIFT_SEND`: +Liability (User B earns).
    *   `CASHOUT_REQUEST`: No change to liability yet (funds locked).
    *   `CASHOUT_APPROVE`: -Liability (User paid), +Paid USD.
    *   `CASHOUT_REJECT`: Funds unlocked.

## 3. New V2 Functions

We will implement the following `plpgsql` functions to handle logic atomically:

1.  **`send_gift_v2(sender_id, receiver_id, gift_id, amount)`**:
    *   Deducts from Sender (`Troll_coins` or `troll_coins`).
    *   Credits Receiver (`troll_coins` AND `earned_balance`).
    *   Updates `admin_pool` (+Liability).
    *   Logs to `coin_transactions` and `admin_pool_ledger`.
2.  **`request_cashout_v2(user_id)`**:
    *   Calculates max cashable (`MIN(balance, earned)`).
    *   Validates Tiers ($25, $70, etc.).
    *   Locks funds (moves `earned_balance` -> `frozen_balance`?). *Actually, we'll just deduct from `earned_balance` and `troll_coins` immediately and hold in `payout_request` or a generic escrow, or use a `frozen` column. To be safe/simple: Deduct immediately, refund if rejected.*
3.  **`approve_cashout_v2(request_id, admin_id)`**:
    *   Finalizes the transaction.
    *   Updates `admin_pool` (-Liability, +Paid).
