-- Empire Partner Program - Recruitment-Based Rewards System
-- Create tables for referral tracking and rewards

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referred_at TIMESTAMPTZ DEFAULT NOW(),
    reward_status TEXT DEFAULT 'pending' CHECK (reward_status IN ('pending', 'completed', 'failed')),
    deadline TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent self-referrals and duplicate referrals
    CONSTRAINT no_self_referral CHECK (referrer_id != referred_user_id),
    UNIQUE(referrer_id, referred_user_id)
);

-- Empire Partner Rewards table
CREATE TABLE IF NOT EXISTS empire_partner_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coins_awarded BIGINT NOT NULL DEFAULT 10000,
    rewarded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one reward per referral
    UNIQUE(referrer_id, referred_user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_reward_status ON referrals(reward_status);
CREATE INDEX IF NOT EXISTS idx_referrals_deadline ON referrals(deadline);
CREATE INDEX IF NOT EXISTS idx_empire_partner_rewards_referrer_id ON empire_partner_rewards(referrer_id);

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE empire_partner_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referrals
CREATE POLICY "Users can view their own referrals" ON referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_user_id);

CREATE POLICY "Users can insert referrals for themselves" ON referrals
    FOR INSERT WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can update their own referral status" ON referrals
    FOR UPDATE USING (auth.uid() = referrer_id);

-- RLS Policies for rewards
CREATE POLICY "Users can view their own rewards" ON empire_partner_rewards
    FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "System can insert rewards" ON empire_partner_rewards
    FOR INSERT WITH CHECK (true);

-- Function to automatically set deadline (21 days from referral)
CREATE OR REPLACE FUNCTION set_referral_deadline()
RETURNS TRIGGER AS $$
BEGIN
    NEW.deadline := NEW.referred_at + INTERVAL '21 days';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set deadline automatically
CREATE TRIGGER set_referral_deadline_trigger
    BEFORE INSERT ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION set_referral_deadline();

-- Function to check and process referral rewards
CREATE OR REPLACE FUNCTION process_referral_rewards()
RETURNS TRIGGER AS $$
DECLARE
    referral_record RECORD;
    current_troll_coins BIGINT;
BEGIN
    -- Only process if troll_coins increased
    IF NEW.troll_coins > OLD.troll_coins THEN
        -- Check if this user was referred
        SELECT * INTO referral_record
        FROM referrals
        WHERE referred_user_id = NEW.user_id
        AND reward_status = 'pending'
        AND deadline > NOW();

        IF FOUND THEN
            -- Get current total troll_coins
            SELECT COALESCE(SUM(troll_coins), 0) INTO current_troll_coins
            FROM wallets
            WHERE user_id = NEW.user_id;

            -- Check if they reached 40,000 troll_coins
            IF current_troll_coins >= 40000 THEN
                -- Mark referral as completed
                UPDATE referrals
                SET reward_status = 'completed', updated_at = NOW()
                WHERE id = referral_record.id;

                -- Insert reward record
                INSERT INTO empire_partner_rewards (referrer_id, referred_user_id, coins_awarded)
                VALUES (referral_record.referrer_id, NEW.user_id, 10000);

                -- Add coins to referrer's wallet
                INSERT INTO wallets (user_id, troll_coins, updated_at)
                VALUES (referral_record.referrer_id, 10000, NOW())
                ON CONFLICT (user_id)
                DO UPDATE SET
                    troll_coins = wallets.troll_coins + 10000,
                    updated_at = NOW();

                -- Log the transaction
                INSERT INTO coin_transactions (
                    user_id,
                    amount,
                    transaction_type,
                    description,
                    created_at
                ) VALUES (
                    referral_record.referrer_id,
                    10000,
                    'referral_reward',
                    'Empire Partner referral reward for recruiting ' || (SELECT username FROM profiles WHERE id = NEW.user_id),
                    NOW()
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process rewards when wallet is updated
CREATE TRIGGER process_referral_rewards_trigger
    AFTER UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION process_referral_rewards();

-- Function to mark expired referrals as failed
CREATE OR REPLACE FUNCTION mark_expired_referrals_failed()
RETURNS void AS $$
BEGIN
    UPDATE referrals
    SET reward_status = 'failed', updated_at = NOW()
    WHERE reward_status = 'pending'
    AND deadline < NOW();
END;
$$ LANGUAGE plpgsql;