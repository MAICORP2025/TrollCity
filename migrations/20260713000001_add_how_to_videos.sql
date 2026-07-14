-- How-To Videos tutorial library
CREATE TABLE IF NOT EXISTS public.how_to_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  duration INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  file_type TEXT,
  file_size BIGINT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.how_to_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage how-to videos"
  ON public.how_to_videos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true OR user_profiles.role = 'ceo')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true OR user_profiles.role = 'ceo')
    )
  );

CREATE POLICY "Anyone can view published how-to videos"
  ON public.how_to_videos
  FOR SELECT
  TO authenticated, anon
  USING (is_published = true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_how_to_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_how_to_videos_updated_at ON public.how_to_videos;
CREATE TRIGGER update_how_to_videos_updated_at
  BEFORE UPDATE ON public.how_to_videos
  FOR EACH ROW EXECUTE FUNCTION public.update_how_to_videos_updated_at();
