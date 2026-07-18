# TODO - Admin settings null key fix

## Plan summary
Fix migration failure: `null value in column "key" of relation "admin_settings" violates not-null constraint`.

## Steps
- [ ] Inspect schema/constraints for `public.admin_settings` (columns + unique index conflict target).
- [x] Update migration to use the correct column name(s) (`key`/`value`).
- [ ] Ensure inserted JSON uses correct column types and matches table definition.
- [ ] Use an `ON CONFLICT` clause that targets the actual unique constraint.
- [ ] Re-run the specific migration (or apply migration in a clean DB) to confirm the error is gone.

