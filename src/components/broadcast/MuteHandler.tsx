import { useEffect } from 'react';
import { useRoom } from '../../hooks/useRoom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';

export default function MuteHandler({ streamId }: { streamId: string }) {
    const { localAudioTrack, isMicrophoneEnabled, toggleMicrophone } = useRoom();
    const { user } = useAuthStore();
    const userId = user?.id;

    useEffect(() => {
        if (!streamId || !streamId.trim()) return;
        if (!localAudioTrack) return;

        // TODO: Get the actual user ID. Assuming a placeholder for now.
        const currentUserId = userId; // Replace with actual user ID

        // Check initial mute
        const checkMute = async () => {
             const { data } = await supabase.from('stream_mutes').select('id').eq('stream_id', streamId).eq('user_id', currentUserId).maybeSingle();
             if (data) {
                 if (isMicrophoneEnabled) { toggleMicrophone(); }
                 toast.error("You have been muted by a moderator.");
             }
        };
        checkMute();

        const channel = supabase.channel(`mutes:${streamId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'stream_mutes', 
                filter: `stream_id=eq.${streamId}` 
            }, (payload) => {
                const data = (payload as any).new;
                if (data && data.user_id === currentUserId) {
                    if (isMicrophoneEnabled) { toggleMicrophone(); }
                    toast.error("You have been muted by a moderator.");
                }
            })
            .on('postgres_changes', { 
                event: 'DELETE', 
                schema: 'public', 
                table: 'stream_mutes', 
                filter: `stream_id=eq.${streamId}` 
            }, (payload) => {
                 const data = (payload as any).old;
                 if (data && data.user_id === currentUserId) {
                     if (!isMicrophoneEnabled) { toggleMicrophone(); }
                     toast.success("You have been unmuted.");
                 }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [streamId, userId, localAudioTrack, isMicrophoneEnabled, toggleMicrophone]);

    return null;
}
