-- Fix bad HLS URLs that point to cdn.maitrollcity.com
-- We are switching to relative URLs to use Vercel rewrites and avoid CORS issues

UPDATE public.streams
SET hls_url = REPLACE(hls_url, 'https://cdn.maitrollcity.com', '')
WHERE hls_url LIKE 'https://cdn.maitrollcity.com%';

UPDATE public.pod_rooms
SET hls_url = REPLACE(hls_url, 'https://cdn.maitrollcity.com', '')
WHERE hls_url LIKE 'https://cdn.maitrollcity.com%';

UPDATE public.court_sessions
SET hls_url = REPLACE(hls_url, 'https://cdn.maitrollcity.com', '')
WHERE hls_url LIKE 'https://cdn.maitrollcity.com%';
