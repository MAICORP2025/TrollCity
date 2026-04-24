-- Add defaults to columns that need them

-- gift_ledger defaults
ALTER TABLE gift_ledger ALTER COLUMN amount SET DEFAULT 0;
ALTER TABLE gift_ledger ALTER COLUMN gift_id SET DEFAULT '';
ALTER TABLE gift_ledger ALTER COLUMN receiver_id SET DEFAULT NULL;
ALTER TABLE gift_ledger ALTER COLUMN sender_id SET DEFAULT NULL;

-- notifications defaults
ALTER TABLE notifications ALTER COLUMN user_id SET DEFAULT NULL;

-- streams defaults
ALTER TABLE streams ALTER COLUMN title SET DEFAULT '';

SELECT 'Defaults added to 6 columns' AS result;