-- Update Micro Troll pack pricing for both schema variants
DO $$
BEGIN
  IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'coin_packages'
      AND column_name = 'coins'
  ) THEN
    IF EXISTS(SELECT 1 FROM coin_packages WHERE coins = 100) THEN
      UPDATE coin_packages
      SET price_usd = 0.45,
          paypal_sku = COALESCE(paypal_sku, 'coins_100')
      WHERE coins = 100;
    ELSE
      INSERT INTO coin_packages (name, coins, price_usd, paypal_sku, is_active)
      VALUES ('Micro Troll', 100, 0.45, 'coins_100', TRUE);
    END IF;
  END IF;

  IF EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'coin_packages'
      AND column_name = 'coin_amount'
  ) THEN
    IF EXISTS(SELECT 1 FROM coin_packages WHERE coin_amount = 100) THEN
      UPDATE coin_packages
      SET price = 0.45
      WHERE coin_amount = 100;
    ELSE
      INSERT INTO coin_packages (name, coin_amount, price, currency, description, is_active)
      VALUES ('Micro Troll', 100, 0.45, 'USD', 'Quick boost', TRUE);
    END IF;
  END IF;
END;
$$;
