SELECT 
  id,
  user_id,
  endpoint,
  LENGTH(p256dh_key) as p256dh_length,
  LENGTH(auth_key) as auth_length,
  p256dh_key,
  auth_key,
  is_active
FROM web_push_subscriptions 
WHERE user_id = ''8dff9f37-21b5-4b8e-adc2-b9286874be1a''
LIMIT 4;
