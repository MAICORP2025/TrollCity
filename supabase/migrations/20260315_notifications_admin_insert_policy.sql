-- Allow the admin account to insert notifications for others so RPCs like
-- `notify_user_rpc` can be used from the admin dashboard without RLS errors.

ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications insert admin" ON public.notifications;

CREATE POLICY "notifications insert admin"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'trollcity2025@gmail.com');
