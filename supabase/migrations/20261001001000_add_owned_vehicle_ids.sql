DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD COLUMN owned_vehicle_ids JSONB DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
