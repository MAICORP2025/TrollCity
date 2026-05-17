-- Mai Class: 20 students per organization per class enrollment limit
-- This migration creates the schema and enforcement for the Mai Class student limit

-- Create mai_classes table if it doesn't exist
CREATE TABLE IF NOT EXISTS mai_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  instructor_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active', -- active, inactive, archived
  max_students_per_org INT DEFAULT 20,
  class_schedule TEXT, -- JSON: days of week, time, duration
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create mai_class_enrollments table if it doesn't exist
CREATE TABLE IF NOT EXISTS mai_class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES mai_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'enrolled', -- enrolled, pending, withdrawn, removed
  enrollment_date TIMESTAMP DEFAULT now(),
  withdrawn_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Enforce unique enrollment per student per class
  UNIQUE(class_id, student_id)
);

-- Create an index for fast lookups
CREATE INDEX IF NOT EXISTS idx_mai_class_enrollments_org_class ON mai_class_enrollments(organization_id, class_id, status);
CREATE INDEX IF NOT EXISTS idx_mai_class_enrollments_student ON mai_class_enrollments(student_id, status);

-- Create function to enforce 20-student limit per organization per class
CREATE OR REPLACE FUNCTION enforce_mai_class_student_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INT;
  max_allowed INT;
BEGIN
  -- Only enforce for active enrollments
  IF NEW.status = 'enrolled' THEN
    -- Get the max students for this class
    SELECT COALESCE(max_students_per_org, 20) INTO max_allowed
    FROM mai_classes
    WHERE id = NEW.class_id;
    
    -- Count active students from this organization in this class
    SELECT COUNT(*) INTO current_count
    FROM mai_class_enrollments
    WHERE class_id = NEW.class_id 
      AND organization_id = NEW.organization_id
      AND status = 'enrolled'
      AND id != COALESCE(NEW.id, 'null'::uuid);
    
    -- Check if adding this student would exceed the limit
    IF current_count >= max_allowed THEN
      RAISE EXCEPTION 'Organization % cannot have more than % students in this class. Current: %', 
        NEW.organization_id, max_allowed, current_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce the limit on insert and update
DROP TRIGGER IF EXISTS trg_enforce_mai_class_student_limit ON mai_class_enrollments;
CREATE TRIGGER trg_enforce_mai_class_student_limit
BEFORE INSERT OR UPDATE ON mai_class_enrollments
FOR EACH ROW
EXECUTE FUNCTION enforce_mai_class_student_limit();

-- Enable RLS on both tables
ALTER TABLE mai_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mai_class_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS for mai_classes: publicly readable, admin can create/update/delete
CREATE POLICY "mai_classes_public_read" ON mai_classes
  FOR SELECT USING (status = 'active');

CREATE POLICY "mai_classes_admin_all" ON mai_classes
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role = 'admin' OR is_admin = true
    )
  );

CREATE POLICY "mai_classes_instructor_update" ON mai_classes
  FOR UPDATE USING (
    instructor_id = auth.uid()
  );

-- RLS for mai_class_enrollments: students can read their own enrollments
CREATE POLICY "mai_class_enrollments_read_own" ON mai_class_enrollments
  FOR SELECT USING (
    student_id = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role = 'admin' OR is_admin = true
    )
  );

CREATE POLICY "mai_class_enrollments_admin_all" ON mai_class_enrollments
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM user_profiles 
      WHERE role = 'admin' OR is_admin = true
    )
  );

-- Create a function to get available enrollment slots for an organization in a class
CREATE OR REPLACE FUNCTION get_available_mai_class_slots(
  p_class_id UUID,
  p_org_id UUID
)
RETURNS INT AS $$
DECLARE
  max_allowed INT;
  current_count INT;
  available_slots INT;
BEGIN
  -- Get max students for this class
  SELECT COALESCE(max_students_per_org, 20) INTO max_allowed
  FROM mai_classes
  WHERE id = p_class_id;
  
  -- Get current enrollment count
  SELECT COUNT(*) INTO current_count
  FROM mai_class_enrollments
  WHERE class_id = p_class_id
    AND organization_id = p_org_id
    AND status = 'enrolled';
  
  available_slots := max_allowed - current_count;
  RETURN GREATEST(available_slots, 0);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON mai_classes TO authenticated;
GRANT SELECT ON mai_class_enrollments TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_mai_class_slots TO authenticated;
