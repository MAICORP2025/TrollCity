-- Admin Revenue Dashboard Views
-- Lightweight views for economy analytics

-- Monthly revenue view
CREATE OR REPLACE VIEW admin_coin_revenue AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  SUM(platform_profit) AS total_usd,
  SUM(amount) AS total_coins,
  COUNT(*) AS purchase_count
FROM coin_transactions
WHERE type = 'purchase'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY DATE_TRUNC('month', created_at) DESC;

-- Top buyers view
CREATE OR REPLACE VIEW admin_top_buyers AS
SELECT
  t.user_id,
  p.username,
  SUM(t.platform_profit) AS total_spent_usd,
  SUM(t.amount) AS total_coins_bought,
  COUNT(*) AS transaction_count
FROM coin_transactions t
JOIN user_profiles p ON p.id = t.user_id
WHERE t.type = 'purchase'
GROUP BY t.user_id, p.username
ORDER BY total_spent_usd DESC;

-- Grant access to authenticated users (admins will filter in app)
GRANT SELECT ON admin_coin_revenue TO authenticated;
GRANT SELECT ON admin_top_buyers TO authenticated;

