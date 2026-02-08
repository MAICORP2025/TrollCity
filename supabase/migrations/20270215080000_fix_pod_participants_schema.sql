
-- Ensure columns exist in pod_room_participants
ALTER TABLE public.pod_room_participants 
ADD COLUMN IF NOT EXISTS is_hand_raised BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false;

-- Enable RLS (just in case)
ALTER TABLE public.pod_room_participants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can update their own hand raise status
-- We drop existing update policies to avoid conflicts if they were named differently
DROP POLICY IF EXISTS "Users can update own hand raise" ON public.pod_room_participants;
CREATE POLICY "Users can update own hand raise" ON public.pod_room_participants
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Hosts can manage participants (mute, role change, lower hand)
DROP POLICY IF EXISTS "Hosts can manage participants" ON public.pod_room_participants;
CREATE POLICY "Hosts can manage participants" ON public.pod_room_participants
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.pod_rooms
            WHERE id = pod_room_participants.room_id
            AND host_id = auth.uid()
        )
    );

-- Policy: Hosts can remove participants
DROP POLICY IF EXISTS "Hosts can remove participants" ON public.pod_room_participants;
CREATE POLICY "Hosts can remove participants" ON public.pod_room_participants
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.pod_rooms
            WHERE id = pod_room_participants.room_id
            AND host_id = auth.uid()
        )
    );
