-- Ensure family_members references troll_families so Supabase auto-maps the relationship
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'family_members'
      AND tc.constraint_name = 'family_members_family_id_fkey'
  ) THEN
    ALTER TABLE public.family_members
      ADD CONSTRAINT family_members_family_id_fkey
      FOREIGN KEY (family_id)
      REFERENCES public.troll_families (id)
      ON DELETE CASCADE;
  END IF;
END;
$$;
