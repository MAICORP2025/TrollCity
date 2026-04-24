-- Fix: Remove duplicate broadcast_officers entries that violate unique constraint
-- Keeps the first record for each broadcaster_id + officer_id pair

DELETE FROM broadcast_officers
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY broadcaster_id, officer_id ORDER BY created_at) as rn
    FROM broadcast_officers
  ) sub
  WHERE rn > 1
);

-- Verify no duplicates remain
-- SELECT broadcaster_id, officer_id, COUNT(*) as cnt FROM broadcast_officers GROUP BY broadcaster_id, officer_id HAVING COUNT(*) > 1;