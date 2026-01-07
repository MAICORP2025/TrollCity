-- FIX RECURSION FINAL SCRIPT
-- Purpose: Dynamically drop ALL user_profiles policies and apply safe defaults.
-- Run this ENTIRE script in the Supabase SQL Editor.

BEGIN;

-- 1. KILL SWITCH: Terminate all connections accessing user_profiles
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND datname = current_database()
  AND (
    query ILIKE '%user_profiles%' 
    OR query ILIKE '%system_errors%'
    OR state = 'idle in transaction'
  );

-- 2. DYNAMIC POLICY CLEANUP (The "Nuke" Option)
-- This iterates through system tables and drops EVERY policy on user_profiles
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', r.policyname);
  END LOOP;
END $$;

-- 3. APPLY SAFE POLICIES (Non-Recursive)

-- SELECT: Public access (prevents recursion because it doesn't check role)
CREATE POLICY "Anyone can view user profiles"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- UPDATE: Owner only (checks ID against auth.uid(), safe)
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- INSERT: Owner only (for signups) + Service Role
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can insert profiles"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 4. FIX SYSTEM ERRORS (Add missing column)
CREATE TABLE IF NOT EXISTS public.system_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text,
  stack text,
  user_id uuid,
  url text,
  component text,
  context jsonb,
  status text DEFAULT 'open',
  admin_response text,
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_errors' AND column_name = 'context'
  ) THEN
    ALTER TABLE public.system_errors ADD COLUMN context jsonb;
  END IF;
END $$;

ALTER TABLE public.system_errors ENABLE ROW LEVEL SECURITY;

-- Reset system_errors policies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'system_errors' 
    AND schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.system_errors', r.policyname);
  END LOOP;
END $$;

-- Allow public inserts
CREATE POLICY "Public can insert errors" ON public.system_errors FOR INSERT WITH CHECK (true);

-- Allow admins to view (SAFE VERSION - relies on the safe user_profiles SELECT policy)
CREATE POLICY "Admins can view errors" ON public.system_errors FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

-- 5. FIX FAMILY MEMBERS RECURSION (Infinite Recursion Fix)

-- Create helper function to check membership without triggering RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.check_family_membership(check_family_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members 
    WHERE family_id = check_family_id 
    AND user_id = check_user_id
  );
$$;

-- Helper for checking admin/leader status safely
CREATE OR REPLACE FUNCTION public.check_family_admin(check_family_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_members 
    WHERE family_id = check_family_id 
    AND user_id = check_user_id
    AND role IN ('leader', 'officer', 'royal_troll', 'founder')
  );
$$;

-- Drop all existing policies on family_members to clear the recursion
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'family_members' 
    AND schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.family_members', r.policyname);
  END LOOP;
END $$;

-- Apply Safe Policies

-- 1. View: Users can view themselves
CREATE POLICY "Users can view own membership"
  ON public.family_members
  FOR SELECT
  USING (user_id = auth.uid());

-- 2. View: Users can view other members of THEIR families (uses Security Definer function)
CREATE POLICY "Users can view members of their families"
  ON public.family_members
  FOR SELECT
  USING (public.check_family_membership(family_id, auth.uid()));

-- 3. Manage: Leaders/Admins can manage their family members
CREATE POLICY "Leaders can manage family members"
  ON public.family_members
  FOR ALL
  USING (public.check_family_admin(family_id, auth.uid()));

-- 4. Insert: Users can join (if open) or be added (handled by Leaders policy above)
-- Explicitly allow users to insert themselves (joining)
CREATE POLICY "Users can join families"
  ON public.family_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 6. FIX RELATED TABLES (families, troll_families, family_tasks)
-- Drop policies on related tables that might cause recursion

DO $$
DECLARE
  r RECORD;
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['families', 'troll_families', 'family_tasks']) LOOP
    FOR r IN (
      SELECT policyname 
      FROM pg_policies 
      WHERE tablename = t
      AND schemaname = 'public'
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- Apply Safe Policies for Families/Troll Families
-- View: Public (or authenticated)
CREATE POLICY "Anyone can view families" ON public.families FOR SELECT USING (true);
CREATE POLICY "Anyone can view troll_families" ON public.troll_families FOR SELECT USING (true);

-- Manage: Leaders only (using helper)
CREATE POLICY "Leaders can update families" ON public.families FOR UPDATE 
  USING (founder_id = auth.uid() OR public.check_family_admin(id, auth.uid()));

CREATE POLICY "Leaders can update troll_families" ON public.troll_families FOR UPDATE 
  USING (leader_id = auth.uid() OR public.check_family_admin(id, auth.uid()));

-- Insert: Authenticated
CREATE POLICY "Auth users can create families" ON public.families FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth users can create troll_families" ON public.troll_families FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 7. FIX FOREIGN KEYS (Ensure family_members points to troll_families)
-- This fixes the "violates foreign key constraint" error when creating a family
DO $$
BEGIN
  -- Drop the old constraint (likely referencing 'families')
  ALTER TABLE public.family_members 
  DROP CONSTRAINT IF EXISTS family_members_family_id_fkey;

  -- Add the new constraint referencing 'troll_families'
  -- Note: If this fails, it means you have 'family_members' rows that don't match any 'troll_families' row.
  -- In that case, you might need to truncate family_members or migrate data.
  ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_family_id_fkey
  FOREIGN KEY (family_id)
  REFERENCES public.troll_families(id)
  ON DELETE CASCADE;
  
EXCEPTION WHEN foreign_key_violation THEN
  RAISE WARNING 'Could not switch family_members FK to troll_families due to existing data. Please clear family_members table if this is a fresh install.';
END $$;

COMMIT;
