-- Rename "Neon City Showdown" to "Troll City Showdown"
UPDATE public.tournaments
SET 
  title = 'Troll City Showdown',
  description = REPLACE(description, 'Neon City Showdown', 'Troll City Showdown')
WHERE title = 'Neon City Showdown';
