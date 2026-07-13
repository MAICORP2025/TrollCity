# Troll Wall post retention cleanup

## What this migration does

The migration in [supabase/migrations/20260712000020_post_retention_cleanup.sql](supabase/migrations/20260712000020_post_retention_cleanup.sql) adds a server-side cleanup function that:

- targets the existing public.troll_wall_posts table rather than creating a duplicate post table
- deletes stale rows older than the configured retention window (default 90 days)
- processes deletions in batches to avoid large single transactions
- removes related child rows from the existing tables that reference posts, including likes, gifts, reactions, shares, and daily-login link rows
- deletes matching objects from the post-media storage bucket when the post metadata points to that bucket
- logs each run into public.post_retention_cleanup_runs without storing post content
- skips posts marked as pinned, retention-exempt, or active system-generated posts whose expires_at is still in the future

## Scheduling

If pg_cron is available, the migration schedules the cleanup job daily at 03:00 UTC using:

- `cleanup_troll_wall_post_retention_daily`
- `SELECT public.cleanup_troll_wall_post_retention(90, 1000);`

## Safety notes

- The function uses the existing FK relationships and child tables already present in the schema.
- The cleanup only deletes rows from the post system and its immediate children, and does not touch unrelated user, wallet, moderation, or audit tables.
- The run log records counts and status but does not persist content.
