-- Post Engagement Tracking Tables

-- Views table (with anti-cheat: one view per user per post per day)
create table if not exists troll_post_views (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references troll_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  viewed_at timestamptz default now(),
  unique(post_id, user_id, date_trunc('day', viewed_at))
);

-- Comments table (already exists from previous implementation)
-- troll_post_comments table should have:
-- id, post_id, user_id, content, created_at

-- Reactions table (already exists from previous implementation)
-- troll_post_reactions table should have:
-- id, post_id, user_id, reaction_type, coin_cost, created_at

-- Add indexes for performance
create index if not exists idx_troll_post_views_post_id on troll_post_views(post_id);
create index if not exists idx_troll_post_views_user_id on troll_post_views(user_id);
create index if not exists idx_troll_post_views_viewed_at on troll_post_views(viewed_at);

create index if not exists idx_troll_post_comments_post_id on troll_post_comments(post_id);
create index if not exists idx_troll_post_comments_user_id on troll_post_comments(user_id);
create index if not exists idx_troll_post_comments_created_at on troll_post_comments(created_at);

create index if not exists idx_troll_post_reactions_post_id on troll_post_reactions(post_id);
create index if not exists idx_troll_post_reactions_user_id on troll_post_reactions(user_id);
create index if not exists idx_troll_post_reactions_created_at on troll_post_reactions(created_at);

-- Enable RLS
alter table troll_post_views enable row level security;

-- RLS Policies
create policy "Users can view their own post views" on troll_post_views
  for select using (auth.uid() = user_id);

create policy "Users can insert their own post views" on troll_post_views
  for insert with check (auth.uid() = user_id);

create policy "Post owners can view all views on their posts" on troll_post_views
  for select using (
    exists (
      select 1 from troll_posts
      where id = post_id and user_id = auth.uid()
    )
  );