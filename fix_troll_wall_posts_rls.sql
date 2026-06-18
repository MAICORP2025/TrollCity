-- FIX: Troll Wall Posts Disappearing
-- =================================
-- Root cause analysis:
--
-- 1. The "deny_public_all" policy on troll_wall_posts has USING (false) WITH CHECK (false)
--    with NO role specified. This means it applies to ALL roles. Even though it's a permissive
--    policy (Postgres default), it creates confusion and can interfere with policy evaluation.
--    More importantly, if any migration or tool treats it as restrictive, it blocks everything.
--
-- 2. The "auth_select_own" policy restricts SELECT to only own posts for the "authenticated" role.
--    Combined with "Anyone can view wall posts" (USING true), this should be fine since permissive
--    policies are OR'd. But having both creates ambiguity.
--
-- 3. The "Soft deleted wall posts hidden" policy filters: deleted_at IS NULL OR is_admin(auth.uid())
--    If any process accidentally sets deleted_at on posts, they disappear for non-admin users.
--
-- 4. The global_write_check() function checks is_not_banned() and is_not_suspended().
--    If a user has banned_at or suspended_until set on their profile, they can't create posts.
--
-- Fix: Drop the problematic restrictive/ambiguous policies and ensure clean permissive policies.

-- ============================================
-- TROLL_WALL_POSTS
-- ============================================

-- Drop the blocking deny_public_all policy
DROP POLICY IF EXISTS "deny_public_all" ON "public"."troll_wall_posts";

-- Drop the overly restrictive auth_select_own (users should see ALL posts, not just own)
DROP POLICY IF EXISTS "auth_select_own" ON "public"."troll_wall_posts";

-- Drop duplicate/ambiguous INSERT policies (keep only the clean universal RLS one)
DROP POLICY IF EXISTS "Authenticated users can create posts" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Users can create wall posts" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "auth_insert_own" ON "public"."troll_wall_posts";

-- Drop duplicate SELECT policies (keep only the clean ones)
DROP POLICY IF EXISTS "Anyone can view wall posts" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Users read all posts" ON "public"."troll_wall_posts";

-- Drop duplicate UPDATE/DELETE policies
DROP POLICY IF EXISTS "Users can update their own posts" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Users can delete their own posts" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Users can delete their own wall posts" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "auth_update_own" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "auth_delete_own" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Admins can delete any wall post" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Lead officers can delete any wall post" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Officers can delete any wall post" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Staff remove content" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Soft deleted wall posts hidden" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Soft delete own wall post" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Users create posts" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Users edit own posts" ON "public"."troll_wall_posts";
DROP POLICY IF EXISTS "Users delete own posts" ON "public"."troll_wall_posts";

-- Now create clean, unambiguous policies

-- SELECT: Any authenticated user can read all posts (soft-deleted hidden from non-admins)
CREATE POLICY "troll_wall_posts_select" ON "public"."troll_wall_posts"
    FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND (deleted_at IS NULL OR public.is_admin(auth.uid()))
    );

-- INSERT: Authenticated users can create their own posts (must not be banned/suspended)
CREATE POLICY "troll_wall_posts_insert" ON "public"."troll_wall_posts"
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND user_id = auth.uid()
        AND public.global_write_check(auth.uid())
    );

-- UPDATE: Users can edit their own posts (must not be banned/suspended)
CREATE POLICY "troll_wall_posts_update" ON "public"."troll_wall_posts"
    FOR UPDATE
    USING (
        user_id = auth.uid()
        AND public.global_write_check(auth.uid())
    )
    WITH CHECK (
        user_id = auth.uid()
        AND public.global_write_check(auth.uid())
    );

-- DELETE: Users can delete their own posts, staff can delete any
CREATE POLICY "troll_wall_posts_delete" ON "public"."troll_wall_posts"
    FOR DELETE
    USING (
        user_id = auth.uid()
        OR public.is_staff(auth.uid())
        OR public.is_admin(auth.uid())
    );

-- ============================================
-- WALL_POSTS (legacy table)
-- ============================================
DROP POLICY IF EXISTS "deny_public_all" ON "public"."wall_posts";
DROP POLICY IF EXISTS "auth_select_own" ON "public"."wall_posts";

-- ============================================
-- TROLL_POSTS (profile feed table)
-- ============================================
DROP POLICY IF EXISTS "deny_public_all" ON "public"."troll_posts";
DROP POLICY IF EXISTS "auth_select_own" ON "public"."troll_posts";

-- ============================================
-- TROLL_WALL_LIKES
-- ============================================
DROP POLICY IF EXISTS "deny_public_all" ON "public"."troll_wall_likes";

-- ============================================
-- TROLL_WALL_REACTIONS
-- ============================================
DROP POLICY IF EXISTS "deny_public_all" ON "public"."troll_wall_reactions";

-- ============================================
-- TROLL_WALL_GIFTS
-- ============================================
DROP POLICY IF EXISTS "deny_public_all" ON "public"."troll_wall_gifts";
