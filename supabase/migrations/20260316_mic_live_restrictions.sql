-- Adds tracked fields for microphone mutes and live restrictions so officers can enforce global bans
BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS mic_muted_until timestamptz,
  ADD COLUMN IF NOT EXISTS live_restricted_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_profiles_mic_muted_until ON public.user_profiles(mic_muted_until);
CREATE INDEX IF NOT EXISTS idx_user_profiles_live_restricted_until ON public.user_profiles(live_restricted_until);

COMMIT;
