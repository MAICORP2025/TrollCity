-- Add CEO theme and exclusive theme fields to broadcast_background_themes
-- Migration: Add exclusive theme fields and CEO theme

-- Add new columns to broadcast_background_themes
ALTER TABLE public.broadcast_background_themes
ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS is_system_locked BOOLEAN DEFAULT false NOT NULL;

-- Create CEO theme entry
INSERT INTO public.broadcast_background_themes (
  slug,
  name,
  description,
  preview_url,
  background_type,
  background_asset_url,
  background_css,
  price_coins,
  is_active,
  rarity,
  sort_order,
  asset_type,
  image_url,
  is_exclusive,
  is_system_locked
) VALUES (
  'ceo_gold_premium',
  'CEO Gold Premium',
  'Exclusive ultra-luxury gold broadcast theme for the CEO',
  '/assets/themes/ceo_gold/preview.png',
  'image',
  '/assets/themes/ceo_gold/background.png',
  'background: url("/assets/themes/ceo_gold/background.png") center/cover no-repeat; filter: brightness(1.2) contrast(1.1);',
  0, -- Free for CEO
  true,
  'legendary',
  -1, -- Sort first
  'background_image',
  '/assets/themes/ceo_gold/background.png',
  true, -- is_exclusive
  true  -- is_system_locked
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  preview_url = EXCLUDED.preview_url,
  background_asset_url = EXCLUDED.background_asset_url,
  background_css = EXCLUDED.background_css,
  is_exclusive = true,
  is_system_locked = true;

-- Add RLS policy to prevent CEO theme from being shown in store for non-CEO users
CREATE POLICY "hide_ceo_theme_from_store" ON public.broadcast_background_themes
FOR SELECT TO authenticated
USING (
  slug != 'ceo_gold_premium' OR
  (slug = 'ceo_gold_premium' AND auth.uid() IN (
    SELECT id FROM auth.users WHERE raw_user_meta_data->>'username' = 'ceo'
  ))
);