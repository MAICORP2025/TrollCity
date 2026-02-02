-- ============================================================================
-- FIX: DROP BROKEN FUNCTIONS AND APPLY SEARCH_PATH SECURITY
-- ============================================================================

-- 1. Drop known broken legacy functions that block the migration
-- "refund_payout_coins" references "wallets.paid_coins" which no longer exists.
DROP FUNCTION IF EXISTS public.refund_payout_coins();
DROP FUNCTION IF EXISTS public.refund_payout_coins(uuid);

-- 2. Apply search_path = pg_catalog, public to ALL functions in public schema
-- This prevents "Function Search Path Mutable" vulnerabilities.
DO $$
DECLARE
    func_record RECORD;
    new_def TEXT;
    original_def TEXT;
    func_sig TEXT;
BEGIN
    FOR func_record IN
        SELECT
            n.nspname AS schema_name,
            p.proname AS function_name,
            pg_get_functiondef(p.oid) AS definition,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind = 'f' -- Only normal functions
          AND p.proowner IN (SELECT oid FROM pg_roles WHERE rolname = 'postgres' OR rolname = 'authenticated' OR rolname = 'service_role' OR rolname = current_user)
    LOOP
        BEGIN
            original_def := func_record.definition;
            
            -- Skip if already has search_path set (simple check)
            -- We check for "SET search_path" or "set search_path"
            IF original_def ~* 'SET\s+search_path' THEN
                CONTINUE;
            END IF;

            -- Inject SET search_path before the AS clause
            -- We look for the function body definition to find where to insert.
            -- A safe place is usually after LANGUAGE ... and before AS ...
            -- But pg_get_functiondef returns a standardized format.
            -- It usually looks like: CREATE OR REPLACE FUNCTION ... RETURNS ... LANGUAGE ... ... AS ...
            
            -- We can assume pg_get_functiondef output structure.
            -- A robust way is to replace "AS (dollar-quote)" with "SET search_path = pg_catalog, public AS (dollar-quote)"
            -- But language might come after.
            
            -- Let's try to append it to the end of the header, just before the body starts.
            -- Typically: ... LANGUAGE plpgsql ... AS ...
            -- We want: ... LANGUAGE plpgsql SET search_path = pg_catalog, public AS ...
            
            -- Regex replacement:
            -- Find "AS [\$']" and prepend "SET search_path = pg_catalog, public "
            
            new_def := regexp_replace(original_def, '(AS\s+[\$|''])', 'SET search_path = pg_catalog, public \1', 'i');
            
            -- If no change (regex didn't match), skip
            IF new_def = original_def THEN
                RAISE NOTICE 'Could not inject search_path for %', func_record.function_name;
                CONTINUE;
            END IF;

            -- Execute the update
            EXECUTE new_def;
            
            RAISE NOTICE 'Secured function: %(%)', func_record.function_name, func_record.args;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'FAILED to secure function %(%): %', func_record.function_name, func_record.args, SQLERRM;
        END;
    END LOOP;
END $$;
