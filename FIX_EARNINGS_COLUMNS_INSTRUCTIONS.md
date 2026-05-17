# Fix: Earnings Pages Column Name Consistency

## Problem
The earnings pages were reporting error: `"column user_profiles.Troll_coins does not exist"` 

This was caused by multiple migrations referencing non-existent column names:
- Using `troll_coins` instead of `Troll_coins`
- Using `trollmonds` instead of `troll_coins`

## Root Cause
Several migration files (created between Dec 23-Feb 11) introduced functions that referenced incorrect column names that don't exist in the database schema. The actual columns in `user_profiles` table are:
- `Troll_coins` (bigint) - for troll_coins
- `troll_coins` (bigint) - for free coins

## Files Fixed
The following migration files have been corrected to use proper column names:

1. **20260211_migrate_troll_coins_column_names.sql**
   - Fixed `deduct_coins()` function
   - Fixed `add_troll_coins()` function
   - Fixed `spend_coins()` function
   - Fixed `spend_trollmonds()` function

2. **20251231_spend_coins_rpc.sql**
   - Fixed all SELECT and UPDATE statements for coin operations

3. **20251221_fix_deduct_coins_coin_type.sql**
   - Fixed balance checking logic
   - Fixed coin deduction operations

4. **20251231_add_deduct_coins_function.sql**
   - Fixed balance retrieval and coin deduction

## How to Apply the Fix

### Option 1: Use the Provided Fix File (Recommended)
```sql
-- Copy the entire contents of FIX_COLUMN_NAME_CONSISTENCY.sql
-- Paste into Supabase SQL Editor
-- Click "Run" to execute
```

### Option 2: Manual Steps
1. Ensure columns exist:
   ```sql
   ALTER TABLE user_profiles 
   ADD COLUMN IF NOT EXISTS Troll_coins bigint DEFAULT 0 NOT NULL;
   
   ALTER TABLE user_profiles 
   ADD COLUMN IF NOT EXISTS troll_coins bigint DEFAULT 0 NOT NULL;
   ```

2. Remove any incorrect columns if they exist:
   ```sql
   ALTER TABLE user_profiles DROP COLUMN IF EXISTS troll_coins;
   ALTER TABLE user_profiles DROP COLUMN IF EXISTS trollmonds;
   ```

3. Recreate the earnings view (see FIX_COLUMN_NAME_CONSISTENCY.sql for full view definition)

## Verification
After applying the fix, verify:

```sql
-- Check columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name IN ('Troll_coins', 'troll_coins');

-- Should return 2 rows:
-- Troll_coins
-- troll_coins

-- Check earnings view works
SELECT id, username, Troll_coins FROM earnings_view LIMIT 5;
```

## Frontend Impact
The frontend correctly uses:
- `profile.Troll_coins` - displays user's paid coin balance
- `profile.troll_coins` - displays user's free coin balance

No frontend changes are needed. The data will sync correctly once the database is fixed.

## Notes
- All new migrations (20260211 onward) have been pre-corrected in the repository
- The fix ensures earnings pages, shop pages, and all coin-related features work properly
- Background profile refresh will now correctly sync coin balances
