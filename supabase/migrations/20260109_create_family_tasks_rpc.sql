-- Create RPC to generate family tasks with proper RLS checks
-- Allows leaders/officers to generate weekly tasks server-side

CREATE OR REPLACE FUNCTION create_family_tasks(p_family_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_task_title BOOLEAN;
  has_title BOOLEAN;
BEGIN
  -- Verify caller is authorized (leader/officer/royal_troll) in either members table
  IF NOT (
    EXISTS (
      SELECT 1 FROM troll_family_members 
      WHERE family_id = p_family_id AND user_id = auth.uid() 
      AND role IN ('leader', 'officer', 'royal_troll')
    )
    OR
    EXISTS (
      SELECT 1 FROM family_members 
      WHERE family_id = p_family_id AND user_id = auth.uid() 
      AND role IN ('leader', 'officer', 'founder', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to create family tasks';
  END IF;

  -- Avoid duplicate active task sets
  IF EXISTS (
    SELECT 1 FROM family_tasks 
    WHERE family_id = p_family_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Active tasks already exist');
  END IF;

  -- Detect schema variant
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='family_tasks' AND column_name='task_title') INTO has_task_title;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='family_tasks' AND column_name='title') INTO has_title;

  IF has_task_title THEN
    -- New schema: task_title/task_description + reward_family_* + metrics
    INSERT INTO family_tasks (
      family_id, task_title, task_description,
      reward_family_coins, reward_family_xp,
      goal_value, current_value, metric, status, expires_at
    ) VALUES
    (
      p_family_id,
      'Recruit New Trolls',
      'Grow your family by recruiting 3 new members this week.',
      500, 100,
      3, 0, 'family_members_recruited', 'active',
      NOW() + INTERVAL '7 days'
    ),
    (
      p_family_id,
      'Host a Clan Stream',
      'Start a live stream representing your family.',
      200, 50,
      1, 0, 'streams_started', 'active',
      NOW() + INTERVAL '3 days'
    ),
    (
      p_family_id,
      'Gift Raid',
      'Send 5 gifts to support other trolls.',
      300, 75,
      5, 0, 'gifts_sent', 'active',
      NOW() + INTERVAL '5 days'
    );
  ELSIF has_title THEN
    -- Legacy schema: title/description/category/reward_coins/reward_xp
    INSERT INTO family_tasks (
      family_id, title, description, category,
      reward_coins, reward_xp,
      status, expires_at
    ) VALUES
    (
      p_family_id,
      'Recruit New Trolls',
      'Grow your family by recruiting 3 new members this week.',
      'General',
      500, 100,
      'active',
      NOW() + INTERVAL '7 days'
    ),
    (
      p_family_id,
      'Host a Clan Stream',
      'Start a live stream representing your family.',
      'General',
      200, 50,
      'active',
      NOW() + INTERVAL '3 days'
    ),
    (
      p_family_id,
      'Gift Raid',
      'Send 5 gifts to support other trolls.',
      'General',
      300, 75,
      'active',
      NOW() + INTERVAL '5 days'
    );
  ELSE
    RAISE EXCEPTION 'family_tasks schema not recognized';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION create_family_tasks(UUID) TO authenticated;
