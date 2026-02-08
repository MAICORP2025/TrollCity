-- Migration to fix Pitch/Contest Visibility and Add Walkie Notifications

-- 1. Ensure Public can view Contests and Pitches
DO $$
BEGIN
    -- Pitch Contests
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pitch_contests') THEN
        DROP POLICY IF EXISTS "Public can view contests" ON public.pitch_contests;
        CREATE POLICY "Public can view contests" ON public.pitch_contests FOR SELECT USING (true);
    END IF;

    -- Pitches
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pitches') THEN
        DROP POLICY IF EXISTS "Public view pitches" ON public.pitches;
        CREATE POLICY "Public view pitches" ON public.pitches FOR SELECT USING (true);
    END IF;

    -- Revenue Splits
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue_splits') THEN
        DROP POLICY IF EXISTS "Public view splits" ON public.revenue_splits;
        CREATE POLICY "Public view splits" ON public.revenue_splits FOR SELECT USING (true);
    END IF;
END $$;


-- 2. Add Trigger for Walkie Page Notifications
-- This creates a notification when a walkie page is received, supporting the "Alert Device" requirement.

CREATE OR REPLACE FUNCTION public.handle_walkie_page_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_username TEXT;
BEGIN
    -- Only notify on pending requests
    IF NEW.status = 'pending' THEN
        -- Get sender username
        SELECT username INTO v_sender_username
        FROM public.user_profiles
        WHERE id = NEW.sender_id;

        -- Insert notification
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            message,
            metadata,
            created_at,
            is_read
        ) VALUES (
            NEW.receiver_id,
            CASE WHEN NEW.type = 'bug' THEN 'walkie_bug' ELSE 'walkie_page' END,
            CASE WHEN NEW.type = 'bug' THEN 'Bug Report Received' ELSE 'Incoming Walkie Page' END,
            CASE 
                WHEN NEW.type = 'bug' THEN COALESCE(v_sender_username, 'Someone') || ' reported a bug.'
                ELSE COALESCE(v_sender_username, 'Someone') || ' is paging you.'
            END,
            jsonb_build_object(
                'page_id', NEW.id,
                'sender_id', NEW.sender_id,
                'type', NEW.type,
                'url', '/walkie' -- Or wherever the walkie UI is accessible
            ),
            NOW(),
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists to avoid duplication errors
DROP TRIGGER IF EXISTS on_walkie_page_created ON public.walkie_paging_requests;

-- Create Trigger
CREATE TRIGGER on_walkie_page_created
    AFTER INSERT ON public.walkie_paging_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_walkie_page_notification();

