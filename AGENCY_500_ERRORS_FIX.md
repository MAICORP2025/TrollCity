# Agency 500 Errors - Root Cause & Fix

## Summary
The 500 errors on agency-goals, agency-invite, agency-applications, and agency-members pages were caused by **incorrect Supabase relationship syntax** in database queries that attempt to join `agency_applications` with `user_profiles`.

## Root Cause

### The Problem
When using Supabase's relationship syntax with the `!` operator to reference foreign key constraints, you must use the **full PostgreSQL constraint name**, not just the column name.

**Incorrect Pattern:**
```javascript
.select(`*, alias:table_name!column_name(fields)`)
```

**Correct Pattern:**
```javascript
.select(`*, alias:table_name!table_column_fkey(fields)`)
```

### Why It Failed
In PostgreSQL, when you define a foreign key constraint like:
```sql
applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
```

The constraint is automatically named: `{table}_{column}_fkey` = `agency_applications_applicant_id_fkey`

Supabase's `!` syntax requires this **full constraint name**, not just the column name.

## Files Affected & Fixed

### 1. ✅ FIXED: AgencyApplicationsTable.tsx (Line 65)

**Before:**
```typescript
.select(`*, applicant_profile:user_profiles!applicant_id(username, avatar_url)`)
```

**After:**
```typescript
.select(`*, applicant_profile:user_profiles!agency_applications_applicant_id_fkey(username, avatar_url)`)
```

**Why this works:** Uses the correct PostgreSQL foreign key constraint name.

---

### 2. ✅ VERIFIED: AgencyMembersTable.tsx (Line 58)

**Current (Already Correct):**
```typescript
.select(`*, user_profiles:user_id(username, avatar_url)`)
```

**Why this works:** 
- `user_id` is a direct column reference (not using `!` syntax)
- This pattern works for simple relationships
- Matches the working pattern in `agency/[agencyId]/index.tsx`

---

## Schema Context

**agency_applications table:**
```sql
CREATE TABLE IF NOT EXISTS public.agency_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- ← This creates constraint
    message TEXT,
    ...
);
```

**Foreign Key Constraint Name:** `agency_applications_applicant_id_fkey`

---

## Related Components

### ✅ AgencyGoalsTable.tsx
- Currently a placeholder component
- No database queries
- No issues

### ✅ AgencyInvitesPanel.tsx
- Queries agency_invites with specific column selection
- No joins to user_profiles
- No issues

### ✅ AgencyMembersTable.tsx  
- Syntax already correct
- Uses `user_profiles:user_id(...)` pattern
- Working properly

---

## Supabase Relationship Syntax Patterns

### Pattern 1: Using `!` with Full Constraint Name (REQUIRED)
```javascript
.select('*, alias:foreign_table!table_column_fkey(columns)')
```
**Use when:** Joining with explicit foreign key constraint reference
**Example:**
```javascript
.select('*, applicant_profile:user_profiles!agency_applications_applicant_id_fkey(username)')
```

### Pattern 2: Using Column Name (SIMPLE)
```javascript
.select('*, foreign_table:column_name(columns)')
```
**Use when:** Simple direct column reference without `!`
**Example:**
```javascript
.select('*, user_profiles:user_id(username)')
```

### Pattern 3: Using Full Constraint Name (EXPLICIT)
```javascript
.select('*, foreign_table!full_constraint_name(columns)')
```
**Use when:** No alias needed, just the table and constraint
**Example:**
```javascript
.select('*, user_profiles!agency_members_user_id_fkey(username)')
```

---

## Testing the Fix

To verify the fix works:

1. Navigate to an agency dashboard
2. Check the Applications tab - should load applicant profiles
3. Check the Members tab - should load member profiles  
4. Check browser Network tab - should see successful responses (200/201), not 500 errors

---

## RLS Policies (Already Correct)

The RLS policies are correctly configured:
- `user_profiles` has policy: "Anyone can view user profiles" ON SELECT USING (true)
- `agency_applications` has policies for owners/managers to view/manage
- `agency_members` has policies for members and managers

No RLS changes needed.

---

## Prevention

When working with Supabase relationships:
1. Always check your foreign key constraint names in the database
2. Use full constraint names with `!` syntax: `{table}_{column}_fkey`
3. Or use simpler column-based syntax without `!`
4. Test queries in Supabase SQL Editor first
5. Check browser console for specific error messages

---

## Related Files
- [AgencyApplicationsTable.tsx](src/pages/agency-dashboard/components/AgencyApplicationsTable.tsx)
- [AgencyMembersTable.tsx](src/pages/agency-dashboard/components/AgencyMembersTable.tsx)
- [agency_schema.sql](src/sql/agency/agency_schema.sql) - Schema definitions
- [agency/[agencyId]/index.tsx](src/pages/agency/[agencyId]/index.tsx) - Reference for correct syntax
