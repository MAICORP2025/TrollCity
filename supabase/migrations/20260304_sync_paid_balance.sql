-- Keep troll_coins available for legacy queries while troll_coins is authoritative
BEGIN;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS troll_coins bigint NOT NULL DEFAULT 0;

UPDATE user_profiles
SET troll_coins = COALESCE(troll_coins, 0);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'troll_coins'
  ) THEN
    CREATE OR REPLACE FUNCTION sync_troll_coins()
    RETURNS trigger AS $func$
    BEGIN
      NEW.troll_coins := NEW.troll_coins;
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_paid_balance ON user_profiles;
    CREATE TRIGGER trg_sync_paid_balance
    BEFORE INSERT OR UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION sync_troll_coins();
  END IF;
END;
$$;

COMMIT;
