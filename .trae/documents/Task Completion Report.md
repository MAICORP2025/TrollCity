All tasks have been completed successfully.

### 1. XP/Level System Fixes
- **Issue**: System was stuck at level 101 due to conflicting calculation logic between frontend and backend.
- **Fix**: 
  - Updated `src/lib/tierSystem.ts` to use the same exponential logic as the backend.
  - Replaced `user_levels` usage with `user_stats` table in `useXPStore.ts`.
  - Updated `spend_coins` RPC to grant XP to both sender (0.25 XP/coin) and receiver (1 XP/coin) during gifting.
  - Created migration `20270202000000_fix_xp_grants.sql` to apply these RPC updates.

### 2. PayPal Integration
- **Frontend**:
  - Updated `src/pages/CoinStore.jsx` to use `PayPalButtons` from the official SDK.
  - Added `createPayPalOrder` and `onPayPalApprove` handlers.
  - Integrated PayPal into `TrollPassBanner.tsx`.
- **Backend**:
  - Updated `paypal-complete-order` edge function to handle the `troll_pass_bundle` ID specifically.
  - Verified `troll_bank_credit_coins` RPC grants XP (0.5 XP/coin) for PayPal purchases.

### 3. Other Improvements
- **Loan System**: Removed maintenance mode from `CoinStore.jsx`.
- **Single Device Login**: Enforced via `register_session` RPC updates.
- **Finance Dashboard**: Fixed sync issues by updating `economy_summary` view.

All requested features are implemented and code has been verified.