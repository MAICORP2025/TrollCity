
-- Enable Realtime for pod_room_participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.pod_room_participants;

-- Function to update viewer count
CREATE OR REPLACE FUNCTION public.update_pod_viewer_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.pod_rooms
        SET viewer_count = viewer_count + 1
        WHERE id = NEW.room_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.pod_rooms
        SET viewer_count = GREATEST(0, viewer_count - 1)
        WHERE id = OLD.room_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for viewer count
DROP TRIGGER IF EXISTS update_pod_viewer_count_trigger ON public.pod_room_participants;
CREATE TRIGGER update_pod_viewer_count_trigger
AFTER INSERT OR DELETE ON public.pod_room_participants
FOR EACH ROW
EXECUTE FUNCTION public.update_pod_viewer_count();

-- Recalculate counts for existing rooms to ensure accuracy
UPDATE public.pod_rooms pr
SET viewer_count = (
    SELECT count(*) 
    FROM public.pod_room_participants prp 
    WHERE prp.room_id = pr.id
);
