
SELECT * FROM information_schema.tables WHERE table_name = 'chat_sounds' OR table_name = 'call_sounds';
SELECT * FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name LIKE '%sound%';
