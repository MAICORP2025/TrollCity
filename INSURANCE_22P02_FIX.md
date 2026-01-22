# Insurance System 22P02 Error Fix

## Problem Description
Users encountered error code `22P02` ("invalid input syntax for type uuid") when attempting to purchase insurance from the Coin Store. The error message was: `invalid input syntax for type uuid: \"insurance_full_24h\"`

## Root Cause Analysis
The error occurred because:
1. The `insurance_options` table was not seeded with the required insurance option records
2. The CoinStoreModal was trying to insert records into `user_insurances` with `insurance_id` values like 'insurance_full_24h'
3. Without seeded data, the foreign key constraint validation would fail
4. The error manifested as a PostgreSQL type mismatch because of implicit type conversion attempts

## Database Schema
The system uses two separate insurance-related tables:

### `insurance_options` (for streamable/broadcast insurance)
- **id** (TEXT PRIMARY KEY): Text-based identifiers like 'insurance_full_24h'
- **name** (TEXT): Display name
- **cost** (INTEGER): Price in Troll Coins
- **description** (TEXT): What the insurance covers
- **duration_hours** (INTEGER): How long the insurance lasts
- **protection_type** (TEXT): 'kick', 'full', or 'bankrupt'
- **icon** (TEXT): Emoji representation
- **is_active** (BOOLEAN): Whether this option is available

### `user_insurances` (user purchase records)
- **id** (UUID PRIMARY KEY): Unique record ID
- **user_id** (UUID FOREIGN KEY): References auth.users
- **insurance_id** (TEXT FOREIGN KEY): References insurance_options(id)
- **purchased_at** (TIMESTAMP): When purchased
- **expires_at** (TIMESTAMP): When insurance expires
- **is_active** (BOOLEAN): Whether currently active
- **protection_type** (TEXT): Type of protection
- **times_triggered** (INTEGER): How many times this insurance has been used
- **metadata** (JSONB): Additional data

## Solutions Implemented

### 1. Database Migrations Created

**File**: `supabase/migrations/20270121080000_seed_insurance_options.sql`
- Seeds the `insurance_options` table with default insurance options
- Includes: Kick Insurance (24h), Full Protection (24h), Full Protection (1 Week), Basic Coverage (1 Week)
- Uses `ON CONFLICT (id) DO UPDATE SET` to prevent duplicate key errors

**File**: `supabase/migrations/20270121090000_fix_insurance_foreign_keys.sql`
- Ensures the PRIMARY KEY constraint exists on `insurance_options(id)`
- Verifies the foreign key constraint exists: `user_insurances_insurance_id_fkey`
- Confirms the FK references `insurance_options(id)` (not `insurance_plans(id)`)
- Performs seeding with `ON CONFLICT (id) DO NOTHING` for safe re-running

### 2. Application-Level Improvements

**File**: `src/components/broadcast/CoinStoreModal.tsx`

Added defensive validation before insurance insertion:
```typescript
// Validate insurance_id exists in database before inserting
const { data: insuranceExists } = await supabase
  .from('insurance_options')
  .select('id')
  .eq('id', item.id)
  .single();

if (!insuranceExists) {
  toast.error(`Insurance option "${item.id}" not found in database`);
  return;
}
```

Also added error logging when fetching insurance options:
```typescript
const { data: i, error: insuranceError } = await supabase
  .from('insurance_options')
  .select('*')
  .eq('is_active', true)
  .order('cost', { ascending: true });

if (insuranceError) {
  console.error('Failed to fetch insurance options:', insuranceError);
}
```

## Testing Recommendations

1. **Database Verification**:
   ```sql
   SELECT COUNT(*) as option_count FROM public.insurance_options;
   SELECT * FROM public.insurance_options WHERE id LIKE 'insurance_%';
   ```

2. **Purchase Flow Test**:
   - Open Coin Store
   - Navigate to Insurance tab
   - Attempt to purchase any insurance option
   - Verify success message and database record creation

3. **Data Integrity Check**:
   ```sql
   SELECT u.user_id, u.insurance_id, io.name, u.expires_at
   FROM public.user_insurances u
   LEFT JOIN public.insurance_options io ON u.insurance_id = io.id
   ORDER BY u.created_at DESC
   LIMIT 10;
   ```

## Important Notes

- The `user_insurance` (singular) table is DIFFERENT from `user_insurances` (plural)
  - `user_insurance`: Uses `plan_id` (UUID) referencing `insurance_plans(id)` (UUID) - unused in current app
  - `user_insurances`: Uses `insurance_id` (TEXT) referencing `insurance_options(id)` (TEXT) - actively used

- The app should ONLY use `user_insurances` for broadcast/stream insurance purchases
- `user_insurance` appears to be for a different insurance system (car/property insurance from other features)

## Files Modified
1. `/supabase/migrations/20270121080000_seed_insurance_options.sql` - NEW
2. `/supabase/migrations/20270121090000_fix_insurance_foreign_keys.sql` - NEW
3. `/src/components/broadcast/CoinStoreModal.tsx` - MODIFIED (added validation)

## Migration Execution
Migrations are automatically applied via `npm run run:migrations` which runs the `scripts/run_migrations.js` utility. The migrations use `ON CONFLICT` clauses to safely handle re-runs without data loss.

## Verification Scripts

- `verify_insurance_tables.sql`: run against the target database to confirm the `insurance_options` rows exist and `user_insurances` still references that table.
- `test-insurance.mjs`: invoke with the usual Supabase URL/anon key env vars to reproduce the insert into `user_insurances` and ensure the `22P02` UUID error no longer appears.
