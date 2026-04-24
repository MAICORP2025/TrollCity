-- Post Earnings System Functions

-- 1. Track views, comments, reactions
create or replace function get_post_engagement(post_id uuid)
returns table (
  views bigint,
  comments bigint,
  reactions bigint
)
language sql stable as $$
select
  (select count(*) from troll_post_views where post_id = $1),
  (select count(*) from troll_post_comments where post_id = $1),
  (select count(*) from troll_post_reactions where post_id = $1);
$$;

-- 2. Credit user's free coin balance
create or replace function credit_free_coins(target_user uuid, amount int)
returns void
language sql as $$
update user_profiles
set troll_coins = troll_coins + amount
where id = target_user;
$$;

-- 3. Record view (with anti-cheat: 1 view per user per post per 24h)
create or replace function record_post_view(p_post_id uuid, p_user_id uuid default null)
returns void
language sql as $$
insert into troll_post_views (post_id, user_id, viewed_at)
values (p_post_id, p_user_id, now())
on conflict (post_id, user_id, date_trunc('day', viewed_at))
do nothing;
$$;

-- 4. Get earnings summary for a post
create or replace function get_post_earnings(post_id uuid)
returns table (
  total_earned bigint,
  views bigint,
  comments bigint,
  reactions bigint,
  last_calculated timestamptz
)
language sql stable as $$
select
  coalesce(tp.free_coins_earned, 0),
  (select count(*) from troll_post_views where post_id = $1),
  (select count(*) from troll_post_comments where post_id = $1),
  (select count(*) from troll_post_reactions where post_id = $1),
  tp.updated_at
from troll_posts tp
where tp.id = $1;
$$;