-- Run this in Supabase SQL Editor to set up podcast tables

-- Check existing podcasts table structure and fix it
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'podcasts' ORDER BY ordinal_position;

-- Add missing columns (safe if they already exist)
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS agora_channel_name text;
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS status text DEFAULT 'scheduled';
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS peak_listener_count integer DEFAULT 0;
ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create missing tables
CREATE TABLE IF NOT EXISTS podcast_participants (
  id uuid primary key default gen_random_uuid(),
  podcast_id uuid references podcasts(id) on delete cascade,
  user_id uuid references user_profiles(id) on delete set null,
  username text,
  role text,
  level integer,
  join_time timestamptz default now(),
  leave_time timestamptz,
  duration_seconds integer default 0,
  is_host boolean default false
);

CREATE TABLE IF NOT EXISTS podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  podcast_id uuid references podcasts(id) on delete cascade,
  title text,
  description text,
  duration_seconds integer,
  recorded_at timestamptz default now(),
  audio_url text,
  listener_count integer default 0
);

CREATE TABLE IF NOT EXISTS podcast_rtc_logs (
  id uuid primary key default gen_random_uuid(),
  podcast_id uuid references podcasts(id) on delete set null,
  user_id uuid references user_profiles(id) on delete set null,
  username text,
  role text,
  level integer,
  event_type text not null,
  message text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_podcasts_channel ON podcasts(agora_channel_name);
CREATE INDEX IF NOT EXISTS idx_podcast_participants_podcast ON podcast_participants(podcast_id);
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_podcast ON podcast_episodes(podcast_id);
CREATE INDEX IF NOT EXISTS idx_podcast_rtc_logs_event ON podcast_rtc_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_podcast_rtc_logs_podcast ON podcast_rtc_logs(podcast_id);
CREATE INDEX IF NOT EXISTS idx_podcast_rtc_logs_created ON podcast_rtc_logs(created_at);

-- Enable RLS
ALTER TABLE podcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE podcast_rtc_logs ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
DROP POLICY IF EXISTS "public can read podcasts" ON podcasts;
DROP POLICY IF EXISTS "public can read participants" ON podcast_participants;
DROP POLICY IF EXISTS "public can read episodes" ON podcast_episodes;
DROP POLICY IF EXISTS "authenticated can insert rtc logs" ON podcast_rtc_logs;

CREATE POLICY "public can read podcasts" ON podcasts FOR SELECT USING (TRUE);
CREATE POLICY "public can read participants" ON podcast_participants FOR SELECT USING (TRUE);
CREATE POLICY "public can read episodes" ON podcast_episodes FOR SELECT USING (TRUE);
CREATE POLICY "authenticated can insert rtc logs" ON podcast_rtc_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');