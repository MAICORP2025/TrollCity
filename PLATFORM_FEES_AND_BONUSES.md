# Platform Fees, Bonuses, and Coin Giveaways

This file summarizes the current platform fee settings and the main coin/bonus giveaway mechanics from the codebase.

## Agency Fees

- **Agency application startup fee:** `25,000` Troll Coins
- **First monthly agency fee:** `10,000` Troll Coins

These are enforced in:
- `supabase/migrations/20290526000000_add_paid_agency_application_and_family_conversion.sql`
  - `apply_for_agency_with_fee()`
  - `apply_for_agency_from_family()`
- `process_agency_monthly_fee()` also enforces a minimum monthly fee of `10,000`

## Signup Bonus

- **Welcome bonus:** `100` Troll Coins

This is granted when a new user profile is created via signup in:
- `fix_signup_trigger.sql`

## Gift Bonus

- **Trollz bonus from gifting:** `50%` of the gift coin value

This is awarded by:
- `create_trollz_rpc_functions.sql`
  - `award_trollz_for_gift(p_user_id, p_gift_coins)`

Example:
- Gifting `100` coins awards `50` Trollz
- Gifting `200` coins awards `100` Trollz

## Troll Wheel Rewards

The Troll Wheel offers randomized rewards with these probabilities:

- `30%` chance — Common Trollz: `50` to `200` Trollz
- `25%` chance — Uncommon Trollz: `250` to `500` Trollz
- `20%` chance — Rare Trollz: `600` to `1000` Trollz
- `15%` chance — Bonus Coins: `5` to `25` coins
- `10%` chance — Jackpot Bonus Coins: `50` to `100` coins

Defined in:
- `create_trollz_rpc_functions.sql`
  - Troll Wheel spin logic

## Bonus Coin Notes

- `bonus_coin_balance` is a separate balance for bonus coins
- Bonus coins are generally non-cashout eligible
- They are used for special reward flows like wheel spins and promotional grants

## Additional Notes

- The above summary is based on the current SQL logic and migrations in the repository.
- If more giveaway channels are added later (daily rewards, referrals, achievement rewards, etc.), this file can be updated to include them.
