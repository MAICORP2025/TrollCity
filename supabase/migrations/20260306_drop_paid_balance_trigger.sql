-- Migration: Remove troll_coins trigger and column (troll_coins is authoritative)
-- Date: 2026-03-06

BEGIN;

DROP TRIGGER IF EXISTS trg_sync_paid_balance ON user_profiles;
DROP FUNCTION IF EXISTS sync_troll_coins();

ALTER TABLE user_profiles
DROP COLUMN IF EXISTS troll_coins;

COMMIT;
