-- Add RLS policies for War System
-- Allows leaders/officers to declare wars and members to participate

-- 1. family_wars policies
-- Allow leaders/officers to create wars
CREATE POLICY "family_wars_insert" ON family_wars
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = family_wars.family_a_id
    AND user_id = auth.uid()
    AND role IN ('leader', 'officer')
  )
);

-- Allow leaders/officers to update wars (e.g. end war)
CREATE POLICY "family_wars_update" ON family_wars
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM family_members
    WHERE (family_id = family_wars.family_a_id OR family_id = family_wars.family_b_id)
    AND user_id = auth.uid()
    AND role IN ('leader', 'officer')
  )
);

-- 2. family_war_scores policies
-- Allow leaders/officers to initialize scores for both families when creating a war
CREATE POLICY "family_war_scores_insert" ON family_war_scores
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM family_wars
    WHERE id = family_war_scores.war_id
    AND (
      EXISTS (
        SELECT 1 FROM family_members
        WHERE user_id = auth.uid()
        AND role IN ('leader', 'officer')
        AND (family_id = family_wars.family_a_id OR family_id = family_wars.family_b_id)
      )
    )
  )
);

-- Allow family members to update their own family's score
CREATE POLICY "family_war_scores_update" ON family_war_scores
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM family_members
    WHERE family_id = family_war_scores.family_id
    AND user_id = auth.uid()
  )
);

-- 3. Update family_activity_log policy to allow logging war events for opponent families
-- We drop the existing strict policy and recreate a broader one
DROP POLICY IF EXISTS "family_activity_log_insert" ON family_activity_log;

CREATE POLICY "family_activity_log_insert" ON family_activity_log
FOR INSERT WITH CHECK (
  -- Can insert for own family
  EXISTS (SELECT 1 FROM family_members WHERE family_id = family_activity_log.family_id AND user_id = auth.uid()) 
  OR
  -- Can insert for opponent family if in active war (for war start/end logs)
  EXISTS (
    SELECT 1 FROM family_wars
    WHERE (family_a_id = family_activity_log.family_id OR family_b_id = family_activity_log.family_id)
    AND (
      EXISTS (
        SELECT 1 FROM family_members 
        WHERE (family_id = family_wars.family_a_id OR family_id = family_wars.family_b_id)
        AND user_id = auth.uid()
        AND role IN ('leader', 'officer')
      )
    )
  )
  OR
  -- Admin override
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
