-- Create private storage bucket for how-to videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'how-to-videos',
  'how-to-videos',
  false,
  1073741824,
  ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Admins can upload how-to videos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'how-to-videos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true OR user_profiles.role = 'ceo')
    )
  );

CREATE POLICY "Admins can update how-to videos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'how-to-videos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true OR user_profiles.role = 'ceo')
    )
  );

CREATE POLICY "Admins can delete how-to videos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'how-to-videos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true OR user_profiles.role = 'ceo')
    )
  );

CREATE POLICY "Anyone can view how-to videos"
  ON storage.objects
  FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'how-to-videos');
