-- Add Government Sector to districts
INSERT INTO districts (name, display_name, description, icon, color, required_role, features)
VALUES (
  'government_sector',
  'Government Sector',
  'The seat of power. President, Secretary, and civic duties.',
  'Crown',
  'amber',
  'user',
  '{"enabled": true}'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  features = EXCLUDED.features;
