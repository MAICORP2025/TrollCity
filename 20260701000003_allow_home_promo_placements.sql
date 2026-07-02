ALTER TABLE public.city_ads
DROP CONSTRAINT IF EXISTS valid_placement;

ALTER TABLE public.city_ads
ADD CONSTRAINT valid_placement
CHECK (placement IN (
  'left_sidebar_screensaver',
  'right_panel_featured',
  'home_horizontal_banner',
  'home_right_upper',
  'home_right_lower',
  'left_rail',
  'right_rail'
));
