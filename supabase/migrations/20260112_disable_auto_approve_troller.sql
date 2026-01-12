-- Disable auto-approval for troller applications so admins can review them
DROP TRIGGER IF EXISTS applications_auto_approve_troller ON public.applications;
