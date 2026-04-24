BEGIN;

-- 1. Revoke all permissions from anon and public to enforce Zero Trust
-- We do NOT blindly grant ALL to authenticated anymore.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE USAGE ON SCHEMA public FROM anon;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM public;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM public;
REVOKE USAGE ON SCHEMA public FROM public;

-- 2. Grant USAGE on schema to authenticated
GRANT USAGE ON SCHEMA public TO authenticated;

-- 3. Dynamic RLS and Permission Management
-- Iterate over all tables in public schema to:
--   a) Enable RLS
--   b) Grant SELECT only to authenticated (Read-Only Default)
--   c) Create baseline Read-Only policy for non-sensitive tables if no policies exist
DO $$
DECLARE
    r RECORD;
    policy_count INTEGER;
    is_sensitive BOOLEAN;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        -- a) Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        
        -- b) Grant SELECT only to authenticated (No default write access)
        EXECUTE format('GRANT SELECT ON public.%I TO authenticated', r.tablename);

        -- Check for sensitive tables
        is_sensitive := (
            r.tablename LIKE 'admin_%' OR
            r.tablename LIKE '%_ledger' OR
            r.tablename LIKE '%_transactions' OR
            r.tablename LIKE '%_logs' OR
            r.tablename LIKE '%_audit%' OR
            r.tablename LIKE 'coin_%' OR
            r.tablename LIKE 'bank_%' OR
            r.tablename LIKE 'payout%' OR
            r.tablename LIKE 'payment%' OR
            r.tablename = 'roles' OR
            r.tablename = 'user_roles' OR
            r.tablename = 'user_role_grants' OR
            r.tablename LIKE '%_bans' OR
            r.tablename = 'user_profiles' OR -- Handled explicitly later
            r.tablename LIKE '%_settings' OR
            r.tablename LIKE '%_config' OR
            r.tablename LIKE '%_flags' OR
            r.tablename LIKE '%_permissions' OR
            r.tablename LIKE '%_tokens' OR
            r.tablename LIKE '%_keys' OR
            r.tablename LIKE 'security_%' OR
            r.tablename LIKE 'system_%' OR
            r.tablename LIKE 'ip_%' OR
            r.tablename LIKE '%_ip_%'
        );

        -- c) Baseline Policy Logic
        -- Only create baseline if:
        -- 1. Table is NOT sensitive
        -- 2. No policies currently exist
        IF NOT is_sensitive THEN
            SELECT count(*) INTO policy_count
            FROM pg_policies
            WHERE schemaname = 'public' AND tablename = r.tablename;

            IF policy_count = 0 THEN
                -- Create READ-ONLY baseline policy
                EXECUTE format('CREATE POLICY "Baseline: View for authenticated users" ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', r.tablename);
                RAISE NOTICE 'Created baseline READ-ONLY policy for table: %', r.tablename;
            ELSE
                RAISE NOTICE 'Skipping baseline policy for % (Policies exist)', r.tablename;
            END IF;
        ELSE
            RAISE NOTICE 'Skipping baseline policy for sensitive/excluded table: %', r.tablename;
        END IF;
    END LOOP;
END $$;

-- 4. Secure Signup Flow
--    - Handle user_profiles creation
--    - Safe boolean parsing
--    - Exception isolation for auxiliary inserts ONLY (Profile insert must succeed or fail entire signup)
--    - Strictly SECURITY DEFINER owned by postgres

-- Ensure necessary columns exist on user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;

-- Strict RLS Policies for user_profiles (Explicit Override)
DO $$ 
DECLARE 
    pol record; 
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public'
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname); 
    END LOOP; 
END $$;

-- Re-apply grants specifically for user_profiles
-- Global loop gave SELECT. We need to add UPDATE for the user themselves.
GRANT SELECT, UPDATE ON public.user_profiles TO authenticated;

-- Strict Policies
CREATE POLICY "Users can view own profile" 
ON public.user_profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.user_profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- The Function
CREATE OR REPLACE FUNCTION public.handle_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_username text;
  v_avatar_url text;
  v_email text;
  v_role text;
  v_terms_accepted boolean;
BEGIN
  v_email := COALESCE(NEW.email, '');
  
  -- Default username logic
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    NULLIF(split_part(v_email, '@', 1), ''),
    'user' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  );

  -- Default avatar logic
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || v_username
  );

  -- Force role to user
  v_role := 'user';
  
  -- Safe Boolean Parsing
  BEGIN
    v_terms_accepted := (NEW.raw_user_meta_data->>'terms_accepted')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_terms_accepted := false;
  END;
  v_terms_accepted := COALESCE(v_terms_accepted, false);

  -- Main Profile Insert (Must succeed - No Exception Block)
  INSERT INTO public.user_profiles (
    id,
    username,
    avatar_url,
    bio,
    role,
    tier,
    paid_coins,
    troll_coins,
    total_earned_coins,
    total_spent_coins,
    email,
    terms_accepted,
    onboarding_completed,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_username,
    v_avatar_url,
    'New troll in the city!',
    v_role,
    'Bronze',
    0,
    100,
    100,
    0,
    v_email,
    v_terms_accepted,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Auxiliary 1: Coin Transaction (Safe to fail)
  BEGIN
      INSERT INTO public.coin_transactions (user_id, type, amount, description, created_at)
      VALUES (NEW.id, 'purchase', 100, 'Welcome bonus coins!', NOW())
      ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error inserting welcome coins for %: %', NEW.id, SQLERRM;
  END;
  
  -- Auxiliary 2: User Credit (Safe to fail)
  BEGIN
      INSERT INTO public.user_credit (user_id, score, tier, trend_7d, updated_at)
      VALUES (NEW.id, 400, 'Building', 0, NOW())
      ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error inserting user_credit for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Critical: Ensure function is owned by postgres to bypass RLS
ALTER FUNCTION public.handle_user_signup() OWNER TO postgres;

-- Ensure the trigger is correct
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_signup();

COMMIT;
