-- MAI Studios Supabase Database Setup
-- Run these SQL commands in your Supabase SQL editor

-- Drop existing tables if they exist (for reset)
DROP TABLE IF EXISTS fam_members CASCADE;
DROP TABLE IF EXISTS creator_fams CASCADE;
DROP TABLE IF EXISTS user_rewards_active CASCADE;
DROP TABLE IF EXISTS mai_wheel_spins CASCADE;
DROP TABLE IF EXISTS mai_wheel_rewards CASCADE;
DROP TABLE IF EXISTS message_payments CASCADE;
DROP TABLE IF EXISTS creator_message_pricing CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_members CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS perk_purchases CASCADE;
DROP TABLE IF EXISTS creator_perks CASCADE;
DROP TABLE IF EXISTS creators CASCADE;
DROP TABLE IF EXISTS creator_applications CASCADE;
DROP TABLE IF EXISTS payout_goals CASCADE;
DROP TABLE IF EXISTS series CASCADE;
DROP TABLE IF EXISTS content CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  coin_balance INTEGER DEFAULT 0,
  profile_complete BOOLEAN DEFAULT false,
  role VARCHAR(20) DEFAULT 'user',
  paypal_email VARCHAR(255),
  payment_method VARCHAR(50) DEFAULT 'paypal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (role IN ('user', 'admin', 'creator')),
  CHECK (payment_method IN ('paypal', 'stripe', 'bank'))
);

-- Series Table
CREATE TABLE IF NOT EXISTS series (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (type IN ('purchase', 'grant', 'spend'))
);

-- Content Table (for videos/shorts/movies)
CREATE TABLE IF NOT EXISTS content (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id UUID REFERENCES series(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending',
  is_unlockable BOOLEAN DEFAULT false,
  unlock_price INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (type IN ('short', 'movie')),
  CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Payout Goals Table (for automated payouts on Mon/Fri)
CREATE TABLE IF NOT EXISTS payout_goals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coin_goal INTEGER NOT NULL,
  payout_amount INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_payout_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creator Applications Table
CREATE TABLE IF NOT EXISTS creator_applications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legal_name VARCHAR(255) NOT NULL,
  creator_name VARCHAR(255) NOT NULL,
  dob DATE NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  location VARCHAR(255),
  bio TEXT,
  category VARCHAR(100),
  social_links JSONB,
  id_file_url_front TEXT,
  id_file_url_back TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('pending', 'approved', 'denied'))
);

-- Approved Creators Table
CREATE TABLE IF NOT EXISTS creators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  creator_name VARCHAR(255) NOT NULL,
  bio TEXT,
  category VARCHAR(100),
  perks_enabled BOOLEAN DEFAULT true,
  messaging_paid_enabled BOOLEAN DEFAULT true,
  fams_enabled BOOLEAN DEFAULT true,
  total_earnings INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creator Perks Table
CREATE TABLE IF NOT EXISTS creator_perks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  coin_cost INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  perk_type VARCHAR(100),
  perk_limit INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Perk Purchases Table
CREATE TABLE IF NOT EXISTS perk_purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perk_id UUID NOT NULL REFERENCES creator_perks(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  coin_amount INTEGER NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversation Members Table
CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(conversation_id, user_id)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creator Message Pricing Table
CREATE TABLE IF NOT EXISTS creator_message_pricing (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID NOT NULL UNIQUE REFERENCES creators(id) ON DELETE CASCADE,
  coin_cost_per_message INTEGER NOT NULL DEFAULT 50,
  free_daily_messages INTEGER DEFAULT 0,
  vip_fans_message_free BOOLEAN DEFAULT false,
  fam_members_discount_percent INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message Payments Table
CREATE TABLE IF NOT EXISTS message_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  coin_amount INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MAI Wheel Rewards Table
CREATE TABLE IF NOT EXISTS mai_wheel_rewards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  rarity VARCHAR(50),
  reward_type VARCHAR(100),
  coin_value INTEGER DEFAULT 0,
  duration_hours INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MAI Wheel Spins Table
CREATE TABLE IF NOT EXISTS mai_wheel_spins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id UUID REFERENCES mai_wheel_rewards(id),
  spin_cost INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Rewards Active Table
CREATE TABLE IF NOT EXISTS user_rewards_active (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES mai_wheel_rewards(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Creator Fams (Fan Clubs) Table
CREATE TABLE IF NOT EXISTS creator_fams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  coin_cost_monthly INTEGER NOT NULL,
  max_members INTEGER,
  current_members INTEGER DEFAULT 0,
  perks_included JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fam Members Table
CREATE TABLE IF NOT EXISTS fam_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fam_id UUID NOT NULL REFERENCES creator_fams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(fam_id, user_id)
);

-- Temporarily disable RLS for initial data insertion
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Example: Grant initial coins to your admin account
-- Uncomment and modify the email as needed:
INSERT INTO users (email, username, password, display_name, coin_balance, profile_complete, role)
VALUES ('trollcity2025@gmail.com', 'admin', '$2b$10$trWQgKi3wQLlF4IlXgBxoOKxjDM.kZ3wWfoqjCkaCrl8vl0mB6O3C', 'Admin', 10000, true, 'admin')
ON CONFLICT DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_creator_id ON content(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_series_id ON content(series_id);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
CREATE INDEX IF NOT EXISTS idx_payout_goals_user_id ON payout_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_goals_enabled ON payout_goals(enabled);
CREATE INDEX IF NOT EXISTS idx_creator_applications_user_id ON creator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_applications_status ON creator_applications(status);
CREATE INDEX IF NOT EXISTS idx_creators_user_id ON creators(user_id);
CREATE INDEX IF NOT EXISTS idx_series_creator_id ON series(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_perks_creator_id ON creator_perks(creator_id);
CREATE INDEX IF NOT EXISTS idx_perk_purchases_user_id ON perk_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_perk_purchases_perk_id ON perk_purchases(perk_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creator_message_pricing_creator_id ON creator_message_pricing(creator_id);
CREATE INDEX IF NOT EXISTS idx_message_payments_sender_id ON message_payments(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_payments_creator_id ON message_payments(creator_id);
CREATE INDEX IF NOT EXISTS idx_mai_wheel_spins_user_id ON mai_wheel_spins(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_wheel_spins_created_at ON mai_wheel_spins(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_rewards_active_user_id ON user_rewards_active(user_id);
CREATE INDEX IF NOT EXISTS idx_user_rewards_active_expires_at ON user_rewards_active(expires_at);
CREATE INDEX IF NOT EXISTS idx_creator_fams_creator_id ON creator_fams(creator_id);
CREATE INDEX IF NOT EXISTS idx_fam_members_user_id ON fam_members(user_id);
CREATE INDEX IF NOT EXISTS idx_fam_members_fam_id ON fam_members(fam_id);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can insert their own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can read their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all users" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

-- RLS Policies for transactions table
CREATE POLICY "Users can read their own transactions" ON transactions
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Admins can read all transactions" ON transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

-- RLS Policies for content table
CREATE POLICY "Anyone can read approved content" ON content
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Creators can read their own content" ON content
  FOR SELECT USING (auth.uid()::text = creator_id::text);

-- RLS Policies for payout_goals table
CREATE POLICY "Admins can read all payout goals" ON payout_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role = 'admin'
    )
  );

-- Enable RLS on creator program tables
ALTER TABLE creator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE perk_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_message_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mai_wheel_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE mai_wheel_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards_active ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_fams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fam_members ENABLE ROW LEVEL SECURITY;
