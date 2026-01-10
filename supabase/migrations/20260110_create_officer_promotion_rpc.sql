-- Create RPC function to promote officer after training completion
-- This avoids JSON coercion issues when updating user_profiles

CREATE OR REPLACE FUNCTION update_officer_promotion(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_profiles
  SET
    role = 'troll_officer'::TEXT,
    is_troll_officer = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
