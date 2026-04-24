-- ============================================
-- MAI TALENT DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SEASONS TABLE (Monthly Competition Seasons)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    champion_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('upcoming', 'active', 'completed')) DEFAULT 'upcoming',
    max_auditions INTEGER DEFAULT 150,
    champion_badge_id UUID,
    bonus_coins INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_seasons_status ON public.mt_seasons(status);
CREATE INDEX idx_mt_seasons_start_date ON public.mt_seasons(start_date);

-- ============================================
-- SHOWS TABLE (Live Shows)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_shows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    host_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('scheduled', 'live', 'ended')) DEFAULT 'scheduled',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    youtube_broadcast_id TEXT,
    youtube_stream_id TEXT,
    youtube_stream_key TEXT,
    youtube_stream_url TEXT,
    youtube_live_chat_id TEXT,
    youtube_visibility TEXT DEFAULT 'public',
    performance_duration INTEGER DEFAULT 90,
    crowd_boost_active BOOLEAN DEFAULT false,
    current_boost_multiplier INTEGER DEFAULT 1,
    boost_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_shows_status ON public.mt_shows(status);
CREATE INDEX idx_mt_shows_host_id ON public.mt_shows(host_id);

-- ============================================
-- PERFORMANCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_performances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.mt_shows(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    talent_category TEXT NOT NULL,
    bio TEXT,
    video_url TEXT,
    status TEXT CHECK (status IN ('pending', 'ready', 'performing', 'completed')) DEFAULT 'pending',
    queue_position INTEGER,
    timer_duration INTEGER DEFAULT 90,
    is_sudden_death BOOLEAN DEFAULT false,
    score DECIMAL(10, 2),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_performances_show_id ON public.mt_performances(show_id);
CREATE INDEX idx_mt_performances_user_id ON public.mt_performances(user_id);

-- ============================================
-- SEASON AUDITIONS (Audition Scores & Results)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_season_auditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID REFERENCES public.mt_seasons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    talent_category TEXT NOT NULL,
    bio TEXT,
    video_url TEXT,
    audience_score INTEGER DEFAULT 0,
    judge_score INTEGER DEFAULT 0,
    final_score DECIMAL(10, 2) DEFAULT 0,
    rank INTEGER,
    status TEXT CHECK (status IN ('pending', 'live', 'scored', 'approved', 'rejected')) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_season_auditions_season_id ON public.mt_season_auditions(season_id);
CREATE INDEX idx_mt_season_auditions_user_id ON public.mt_season_auditions(user_id);
CREATE INDEX idx_mt_season_auditions_final_score ON public.mt_season_auditions(final_score DESC);

-- ============================================
-- COMPETITION ROUNDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_competition_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID REFERENCES public.mt_seasons(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    round_name TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK (status IN ('scheduled', 'active', 'completed')) DEFAULT 'scheduled',
    start_date DATE,
    end_date DATE,
    performers_count INTEGER DEFAULT 0,
    advancing_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_competition_rounds_season_id ON public.mt_competition_rounds(season_id);
CREATE INDEX idx_mt_competition_rounds_status ON public.mt_competition_rounds(status);

-- ============================================
-- COMPETITION PERFORMANCES (Round Performances)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_competition_performances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID REFERENCES public.mt_seasons(id) ON DELETE CASCADE,
    round_id UUID REFERENCES public.mt_competition_rounds(id) ON DELETE CASCADE,
    performer_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    performance_order INTEGER,
    vote_score INTEGER DEFAULT 0,
    gift_support INTEGER DEFAULT 0,
    judge_score INTEGER DEFAULT 0,
    final_score DECIMAL(10, 2) DEFAULT 0,
    rank INTEGER,
    status TEXT CHECK (status IN ('waiting', 'performing', 'scored', 'eliminated', 'advanced')) DEFAULT 'waiting',
    eliminated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_competition_performances_round_id ON public.mt_competition_performances(round_id);
CREATE INDEX idx_mt_competition_performances_performer_id ON public.mt_competition_performances(performer_id);
CREATE INDEX idx_mt_competition_performances_final_score ON public.mt_competition_performances(final_score DESC);

-- ============================================
-- COMPETITION VOTES (Real-time Votes)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_competition_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID REFERENCES public.mt_seasons(id) ON DELETE CASCADE,
    performer_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    round_id UUID REFERENCES public.mt_competition_rounds(id),
    vote_value INTEGER DEFAULT 1,
    is_super_vote BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_competition_votes_performer_id ON public.mt_competition_votes(performer_id);
CREATE INDEX idx_mt_competition_votes_voter_id ON public.mt_competition_votes(voter_id);

-- ============================================
-- GIFT TYPES TABLE (Virtual Gift Catalog)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_gift_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    coin_cost INTEGER NOT NULL,
    rarity TEXT CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')) DEFAULT 'common',
    support_weight DECIMAL(5, 2) DEFAULT 0.02,
    has_animation BOOLEAN DEFAULT false,
    animation_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.mt_gift_types (name, emoji, coin_cost, rarity, support_weight, has_animation, sort_order) VALUES
    ('Roses', '🌹', 10, 'common', 0.02, false, 1),
    ('Hearts', '❤️', 15, 'common', 0.02, false, 2),
    ('Thumbs Up', '👍', 20, 'common', 0.02, false, 3),
    ('Star', '⭐', 50, 'uncommon', 0.03, false, 4),
    ('Fire', '🔥', 75, 'uncommon', 0.03, false, 5),
    ('Diamond', '💎', 100, 'rare', 0.04, true, 6),
    ('Crown', '👑', 200, 'rare', 0.05, true, 7),
    ('Trophy', '🏆', 500, 'epic', 0.06, true, 8),
    ('Rocket', '🚀', 1000, 'epic', 0.07, true, 9),
    ('Lightning', '⚡', 2000, 'legendary', 0.08, true, 10),
    ('Golden Crown', '👸', 5000, 'legendary', 0.10, true, 11),
    ('Dragon', '🐉', 10000, 'legendary', 0.15, true, 12);

-- ============================================
-- GIFTS SENT TABLE (Gift Transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_gifts_sent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    performer_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    gift_type_id UUID REFERENCES public.mt_gift_types(id) ON DELETE SET NULL,
    show_id UUID REFERENCES public.mt_shows(id),
    season_id UUID REFERENCES public.mt_seasons(id),
    round_id UUID REFERENCES public.mt_competition_rounds(id),
    coin_value INTEGER NOT NULL,
    support_points INTEGER DEFAULT 0,
    is_combo BOOLEAN DEFAULT false,
    combo_count INTEGER DEFAULT 1,
    combo_bonus INTEGER DEFAULT 0,
    was_boosted BOOLEAN DEFAULT false,
    boost_multiplier INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_gifts_sent_sender_id ON public.mt_gifts_sent(sender_id);
CREATE INDEX idx_mt_gifts_sent_performer_id ON public.mt_gifts_sent(performer_id);
CREATE INDEX idx_mt_gifts_sent_show_id ON public.mt_gifts_sent(show_id);

-- ============================================
-- SHOW PARTICIPANTS TABLE (Role System)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_show_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.mt_shows(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('host', 'judge', 'performer', 'audience')) NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(show_id, user_id, role)
);

CREATE INDEX idx_mt_show_participants_show_id ON public.mt_show_participants(show_id);
CREATE INDEX idx_mt_show_participants_user_id ON public.mt_show_participants(user_id);
CREATE INDEX idx_mt_show_participants_role ON public.mt_show_participants(role);

-- ============================================
-- PERFORMANCE VOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_performance_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performance_id UUID REFERENCES public.mt_performances(id) ON DELETE CASCADE,
    voter_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    vote_type TEXT CHECK (vote_type IN (
        'thumbs_up', 'heart', 'star', 'super_vote',
        'judge_yes', 'judge_no', 'judge_maybe'
    )) NOT NULL,
    vote_value INTEGER DEFAULT 1,
    is_sudden_death BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_performance_votes_performance_id ON public.mt_performance_votes(performance_id);
CREATE INDEX idx_mt_performance_votes_voter_id ON public.mt_performance_votes(voter_id);
CREATE INDEX idx_mt_performance_votes_is_sudden_death ON public.mt_performance_votes(is_sudden_death);

-- ============================================
-- SHOW PERFORMANCES TABLE (Performance History)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_show_performances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.mt_shows(id) ON DELETE CASCADE,
    performer_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    performance_id UUID REFERENCES public.mt_performances(id) ON DELETE SET NULL,
    audience_score INTEGER DEFAULT 0,
    judge_score INTEGER DEFAULT 0,
    total_score DECIMAL(10, 2) DEFAULT 0,
    rank INTEGER,
    is_winner BOOLEAN DEFAULT false,
    is_sudden_death BOOLEAN DEFAULT false,
    sudden_death_votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(show_id, performer_id)
);

CREATE INDEX idx_mt_show_performances_show_id ON public.mt_show_performances(show_id);
CREATE INDEX idx_mt_show_performances_performer_id ON public.mt_show_performances(performer_id);
CREATE INDEX idx_mt_show_performances_rank ON public.mt_show_performances(rank);
CREATE INDEX idx_mt_show_performances_total_score ON public.mt_show_performances(total_score DESC);

-- ============================================
-- SHOW SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_show_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.mt_shows(id) ON DELETE CASCADE UNIQUE,
    performance_duration INTEGER DEFAULT 90,
    sudden_death_duration INTEGER DEFAULT 10,
    max_queue_size INTEGER DEFAULT 20,
    judge_count INTEGER DEFAULT 3,
    enable_sudden_death BOOLEAN DEFAULT true,
    audience_voting_enabled BOOLEAN DEFAULT true,
    judge_voting_enabled BOOLEAN DEFAULT true,
    auto_advance_queue BOOLEAN DEFAULT true,
    require_performer_ready BOOLEAN DEFAULT true,
    ready_timeout_seconds INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_show_settings_show_id ON public.mt_show_settings(show_id);

-- ============================================
-- SHOW_STATES TABLE (Track Show Phase)
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_show_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.mt_shows(id) ON DELETE CASCADE UNIQUE,
    phase TEXT CHECK (phase IN (
        'pre-show', 'curtain-open', 'performing',
        'judging', 'sudden-death', 'winner-announcement', 'ended'
    )) DEFAULT 'pre-show',
    current_performer_id UUID REFERENCES public.user_profiles(id),
    current_queue_position INTEGER DEFAULT 0,
    performance_timer_seconds INTEGER DEFAULT 90,
    sudden_death_enabled BOOLEAN DEFAULT false,
    sudden_death_performer1_id UUID REFERENCES public.user_profiles(id),
    sudden_death_performer2_id UUID REFERENCES public.user_profiles(id),
    winner_id UUID REFERENCES public.user_profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_show_states_show_id ON public.mt_show_states(show_id);

-- ============================================
-- SHOW QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_show_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.mt_shows(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    status TEXT CHECK (status IN ('waiting', 'ready', 'performing', 'completed', 'skipped', 'removed')) DEFAULT 'waiting',
    ready_status TEXT CHECK (ready_status IN ('not_ready', 'ready', 'confirmed')) DEFAULT 'not_ready',
    ready_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    skipped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_show_queue_show_id ON public.mt_show_queue(show_id);
CREATE INDEX idx_mt_show_queue_position ON public.mt_show_queue(position);

-- ============================================
-- PERFORMANCE SCORE CACHE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_performance_score_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performance_id UUID REFERENCES public.mt_performances(id) ON DELETE CASCADE UNIQUE,
    audience_score INTEGER DEFAULT 0,
    judge_score INTEGER DEFAULT 0,
    total_score DECIMAL(10, 2) DEFAULT 0,
    sudden_death_audience_score INTEGER DEFAULT 0,
    sudden_death_judge_score INTEGER DEFAULT 0,
    sudden_death_total_score DECIMAL(10, 2) DEFAULT 0,
    vote_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_performance_score_cache_performance_id ON public.mt_performance_score_cache(performance_id);

-- ============================================
-- SHOW EVENTS LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_show_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.mt_shows(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id UUID REFERENCES public.user_profiles(id),
    target_id UUID,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_show_events_show_id ON public.mt_show_events(show_id);
CREATE INDEX idx_mt_show_events_type ON public.mt_show_events(event_type);
CREATE INDEX idx_mt_show_events_created_at ON public.mt_show_events(created_at);

-- ============================================
-- CROWD BOOST TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_crowd_boosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.mt_shows(id) ON DELETE CASCADE,
    performer_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    milestone_amount INTEGER NOT NULL,
    boost_multiplier INTEGER DEFAULT 2,
    duration_seconds INTEGER DEFAULT 20,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_mt_crowd_boosts_show_id ON public.mt_crowd_boosts(show_id);
CREATE INDEX idx_mt_crowd_boosts_performer_id ON public.mt_crowd_boosts(performer_id);
CREATE INDEX idx_mt_crowd_boosts_is_active ON public.mt_crowd_boosts(is_active);

CREATE TABLE IF NOT EXISTS public.mt_crowd_boost_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    milestone_amount INTEGER NOT NULL UNIQUE,
    boost_multiplier INTEGER DEFAULT 2,
    duration_seconds INTEGER DEFAULT 20,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.mt_crowd_boost_milestones (milestone_amount, boost_multiplier, duration_seconds) VALUES
    (500, 2, 15),
    (1000, 2, 20),
    (2500, 3, 20),
    (5000, 3, 25)
ON CONFLICT (milestone_amount) DO NOTHING;

-- ============================================
-- HALL OF CHAMPIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_hall_of_champions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID REFERENCES public.mt_seasons(id) ON DELETE CASCADE,
    champion_user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    champion_name TEXT NOT NULL,
    runner_up_user_id UUID REFERENCES public.user_profiles(id),
    runner_up_name TEXT,
    second_runner_up_user_id UUID REFERENCES public.user_profiles(id),
    second_runner_up_name TEXT,
    total_votes INTEGER DEFAULT 0,
    total_gift_coins INTEGER DEFAULT 0,
    crown_ceremony_date DATE,
    featured_until DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_hall_of_champions_champion_user_id ON public.mt_hall_of_champions(champion_user_id);
CREATE INDEX idx_mt_hall_of_champions_season_id ON public.mt_hall_of_champions(season_id);

-- ============================================
-- SHOW PHASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_show_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    show_id UUID REFERENCES public.mt_shows(id) ON DELETE CASCADE,
    phase_type TEXT CHECK (phase_type IN ('performance', 'sudden_death', 'audience_save', 'intermission')) DEFAULT 'performance',
    performer_id UUID REFERENCES public.user_profiles(id),
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_show_phases_show_id ON public.mt_show_phases(show_id);
CREATE INDEX idx_mt_show_phases_is_active ON public.mt_show_phases(is_active);

-- ============================================
-- ELIMINATION HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_elimination_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID REFERENCES public.mt_seasons(id) ON DELETE CASCADE,
    round_id UUID REFERENCES public.mt_competition_rounds(id),
    performer_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    elimination_rank INTEGER,
    vote_score INTEGER DEFAULT 0,
    gift_support INTEGER DEFAULT 0,
    final_score DECIMAL(10, 2) DEFAULT 0,
    was_saved BOOLEAN DEFAULT false,
    save_votes INTEGER DEFAULT 0,
    eliminated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mt_elimination_history_season_id ON public.mt_elimination_history(season_id);
CREATE INDEX idx_mt_elimination_history_performer_id ON public.mt_elimination_history(performer_id);

-- ============================================
-- USER BADGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    badge_type TEXT CHECK (badge_type IN (
        'ceo', 'judge', 'auditioner', 'performer',
        'winner', 'top_performer', 'moderator',
        'vip', 'champion'
    )) NOT NULL,
    is_permanent BOOLEAN DEFAULT false,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, badge_type)
);

CREATE INDEX idx_mt_user_badges_user_id ON public.mt_user_badges(user_id);

-- ============================================
-- YOUTUBE BROADCAST SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.mt_youtube_broadcast_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id TEXT NOT NULL,
    stream_key TEXT,
    is_default BOOLEAN DEFAULT true,
    chat_promo_enabled BOOLEAN DEFAULT true,
    chat_promo_interval_seconds INTEGER DEFAULT 60,
    chat_promo_message TEXT DEFAULT 'Join the interactive show at MaiTalent.fun to vote and send gifts.',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.mt_youtube_broadcast_settings (
    channel_id,
    stream_key,
    is_default,
    chat_promo_enabled,
    chat_promo_interval_seconds,
    chat_promo_message
) VALUES (
    '',
    '',
    true,
    true,
    60,
    'Join the interactive show at MaiTalent.fun to vote and send gifts.'
) ON CONFLICT DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Seasons
ALTER TABLE public.mt_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Seasons can be viewed by everyone" ON public.mt_seasons FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT seasons" ON public.mt_seasons FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- Shows
ALTER TABLE public.mt_shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Shows can be viewed by everyone" ON public.mt_shows FOR SELECT USING (true);

-- Performances
ALTER TABLE public.mt_performances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Performances can be viewed by everyone" ON public.mt_performances FOR SELECT USING (true);

-- Season Auditions
ALTER TABLE public.mt_season_auditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Season auditions can be viewed by everyone" ON public.mt_season_auditions FOR SELECT USING (true);
CREATE POLICY "Performers can create MT auditions" ON public.mt_season_auditions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage MT season auditions" ON public.mt_season_auditions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- Competition Rounds
ALTER TABLE public.mt_competition_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Competition rounds can be viewed by everyone" ON public.mt_competition_rounds FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT competition rounds" ON public.mt_competition_rounds FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- Competition Performances
ALTER TABLE public.mt_competition_performances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Competition performances can be viewed by everyone" ON public.mt_competition_performances FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT competition performances" ON public.mt_competition_performances FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- Competition Votes
ALTER TABLE public.mt_competition_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Competition votes can be viewed by everyone" ON public.mt_competition_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote in MT competitions" ON public.mt_competition_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- Gift Types
ALTER TABLE public.mt_gift_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Gift types can be viewed by everyone" ON public.mt_gift_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT gift types" ON public.mt_gift_types FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- Gifts Sent
ALTER TABLE public.mt_gifts_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Gifts sent can be viewed by everyone" ON public.mt_gifts_sent FOR SELECT USING (true);
CREATE POLICY "Users can send MT gifts" ON public.mt_gifts_sent FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Show Participants
ALTER TABLE public.mt_show_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Show participants can be viewed by everyone" ON public.mt_show_participants FOR SELECT USING (true);

-- Performance Votes
ALTER TABLE public.mt_performance_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Performance votes can be viewed by everyone" ON public.mt_performance_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote in MT" ON public.mt_performance_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- Show Performances
ALTER TABLE public.mt_show_performances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Show performances can be viewed by everyone" ON public.mt_show_performances FOR SELECT USING (true);

-- Show Settings
ALTER TABLE public.mt_show_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Show settings can be viewed by everyone" ON public.mt_show_settings FOR SELECT USING (true);

-- Show States
ALTER TABLE public.mt_show_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Show states can be viewed by everyone" ON public.mt_show_states FOR SELECT USING (true);

-- Show Queue
ALTER TABLE public.mt_show_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Queue can be viewed by everyone" ON public.mt_show_queue FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join MT queue" ON public.mt_show_queue FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Performance Score Cache
ALTER TABLE public.mt_performance_score_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Score cache can be viewed by everyone" ON public.mt_performance_score_cache FOR SELECT USING (true);

-- Show Events
ALTER TABLE public.mt_show_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Show events can be viewed by everyone" ON public.mt_show_events FOR SELECT USING (true);
CREATE POLICY "System can insert MT show events" ON public.mt_show_events FOR INSERT WITH CHECK (true);

-- Crowd Boosts
ALTER TABLE public.mt_crowd_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Crowd boosts can be viewed by everyone" ON public.mt_crowd_boosts FOR SELECT USING (true);
CREATE POLICY "System can manage MT crowd boosts" ON public.mt_crowd_boosts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- Crowd Boost Milestones
ALTER TABLE public.mt_crowd_boost_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Milestones can be viewed by everyone" ON public.mt_crowd_boost_milestones FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT milestones" ON public.mt_crowd_boost_milestones FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- Hall of Champions
ALTER TABLE public.mt_hall_of_champions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Hall of champions can be viewed by everyone" ON public.mt_hall_of_champions FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT hall of champions" ON public.mt_hall_of_champions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- Show Phases
ALTER TABLE public.mt_show_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Show phases can be viewed by everyone" ON public.mt_show_phases FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT show phases" ON public.mt_show_phases FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- Elimination History
ALTER TABLE public.mt_elimination_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT Elimination history can be viewed by everyone" ON public.mt_elimination_history FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT elimination history" ON public.mt_elimination_history FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- User Badges
ALTER TABLE public.mt_user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT User badges can be viewed by everyone" ON public.mt_user_badges FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT user badges" ON public.mt_user_badges FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- YouTube Broadcast Settings
ALTER TABLE public.mt_youtube_broadcast_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MT YouTube settings can be viewed by everyone" ON public.mt_youtube_broadcast_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage MT YouTube settings" ON public.mt_youtube_broadcast_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
);

-- ============================================
-- COMPLETE!
-- ============================================