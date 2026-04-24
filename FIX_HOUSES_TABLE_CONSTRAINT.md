# Fix for: null value in column "owner_id" of relation "houses" violates not-null constraint

## Problem Summary
Database is getting an error when trying to insert into the `houses` table without providing the `owner_id` column.

**Error:** `null value in column 'owner_id' of relation 'houses' violates not-null constraint`

## Root Cause
The `houses` table likely has:
1. A column named `owner_id` (not `owner_user_id` as defined in schema)
2. This column has a `NOT NULL` constraint
3. Code is attempting to insert without providing this column
4. Additionally, `neighborhood_id` may also be required but not provided

## Solution

### Step 1: Apply the Database Migration
The migration file `supabase/migrations/20260425000000_fix_houses_owner_id_constraint.sql` handles:

- **Consolidates owner column**: If `owner_id` and `owner_user_id` both exist, normalizes to `owner_user_id`
- **Makes `neighborhood_id` nullable**: Allows houses to exist without neighborhood assignment during onboarding
- **Adds proper RLS policies**: Ensures row-level security
- **Creates indexes**: For performance optimization

**To apply the migration:**

#### Option A: Using Supabase Dashboard
1. Go to Supabase project dashboard
2. Navigate to SQL Editor
3. Open `supabase/migrations/20260425000000_fix_houses_owner_id_constraint.sql`
4. Copy all content and paste into the SQL Editor
5. Click "Run" button

#### Option B: Using Node Script (if RPC available)
```bash
npm install # Ensure dependencies installed
node apply_houses_fix.cjs
```

#### Option C: Manual Database Access
If you have direct database access:
```bash
psql $DATABASE_URL < supabase/migrations/20260425000000_fix_houses_owner_id_constraint.sql
```

### Step 2: Code Verification
The code in `src/pages/NeighborhoodOnboarding.tsx` at line 80 correctly provides:
- `owner_user_id: user.id` ✓

After migration, this will work because:
1. The table will have `owner_user_id` column (not `owner_id`)
2. `neighborhood_id` will be nullable, so omitting it is allowed

### Step 3: Verify Fix
After applying migration, test:

```typescript
// This should now work without errors
const { data: house } = await supabase
  .from('houses')
  .insert({
    owner_user_id: userId,
    upgrade_level: 1,
    condition: 100,
    is_reposessed: false,
    electric_on: false,
    water_on: false,
    internet_on: false
  })
  .select()
  .single()
```

## Files Modified
- **Migration**: `supabase/migrations/20260425000000_fix_houses_owner_id_constraint.sql` (NEW)
- **Helper Script**: `apply_houses_fix.cjs` (NEW)

## Timeline
- Migration created: 2026-04-25
- Column issue: owner_id NOT NULL constraint
- Status: Ready to apply

## Notes
- The migration uses `DO $$` blocks to safely handle idempotent operations
- Existing data won't be lost
- All foreign keys are preserved
- RLS policies allow owner access to their own houses
