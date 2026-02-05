import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { ChatMessage } from '../types/broadcast';

interface VehicleStatus {
  has_vehicle: boolean;
  vehicle_name?: string;
  plate?: string;
  license_status?: string;
  is_suspended?: boolean;
  insurance_active?: boolean;
}

export function useStreamChat(streamId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { user, profile } = useAuthStore();
  const lastSentRef = useRef<number>(0);
  const RATE_LIMIT_MS = 1000;
  
  // Cache for vehicle status
  const [vehicleCache, setVehicleCache] = useState<Record<string, VehicleStatus>>({});

  const fetchVehicleStatus = useCallback(async (userId: string) => {
    if (vehicleCache[userId]) return vehicleCache[userId];
    
    try {
      const { data, error } = await supabase.rpc('get_broadcast_vehicle_status', { target_user_id: userId });
      if (!error && data) {
        setVehicleCache(prev => ({ ...prev, [userId]: data }));
        return data as VehicleStatus;
      }
    } catch (err) {
      console.error('Error fetching vehicle status:', err);
    }
    return null;
  }, [vehicleCache]);

  useEffect(() => {
    if (!streamId) return;

    const fetchMessages = async () => {
        const cutoff = new Date(Date.now() - 25000).toISOString();
        const { data } = await supabase
            .from('stream_messages')
            .select('*, user_profiles(username, avatar_url, role, troll_role, created_at)')
            .eq('stream_id', streamId)
            .gt('created_at', cutoff)
            .order('created_at', { ascending: true });
        
        if (data) {
            const processedMessages = await Promise.all(data.map(async (m: any) => {
                let vStatus = m.vehicle_snapshot as VehicleStatus | undefined;
                
                const uProfile = {
                    username: m.user_name || m.user_profiles?.username || 'Unknown',
                    avatar_url: m.user_avatar || m.user_profiles?.avatar_url || '',
                    role: m.user_role || m.user_profiles?.role,
                    troll_role: m.user_troll_role || m.user_profiles?.troll_role,
                    created_at: m.user_created_at || m.user_profiles?.created_at
                };

                if (!vStatus && !m.vehicle_snapshot) {
                     if (vehicleCache[m.user_id]) {
                         vStatus = vehicleCache[m.user_id];
                     } else {
                         vStatus = await fetchVehicleStatus(m.user_id) || undefined;
                     }
                }

                return {
                    ...m,
                    type: 'chat',
                    user: uProfile, // Map to 'user' for ChatMessage type compatibility if needed, or stick to user_profiles
                    user_profiles: uProfile,
                    vehicle_status: vStatus
                };
            }));
            
            setMessages(processedMessages as ChatMessage[]);
        }
    };

    fetchMessages();

    const chatChannel = supabase
        .channel(`chat_mobile:${streamId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'stream_messages',
            filter: `stream_id=eq.${streamId}`
        }, (payload) => {
            const newRow = payload.new as any;
            
            const newMsg: any = {
                id: newRow.id,
                user_id: newRow.user_id,
                content: newRow.content,
                created_at: newRow.created_at,
                type: 'chat',
                user: {
                    username: newRow.user_name || 'Unknown',
                    avatar_url: newRow.user_avatar || '',
                },
                user_profiles: {
                    username: newRow.user_name || 'Unknown',
                    avatar_url: newRow.user_avatar || '',
                    role: newRow.user_role,
                    troll_role: newRow.user_troll_role,
                    created_at: newRow.user_created_at
                },
                vehicle_status: newRow.vehicle_snapshot
            };

            setMessages(prev => [...prev, newMsg]);
        })
        .subscribe();

    return () => {
        supabase.removeChannel(chatChannel);
    };
  }, [streamId, fetchVehicleStatus, vehicleCache]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || !user || !profile) return;
    
    const now = Date.now();
    if (now - lastSentRef.current < RATE_LIMIT_MS) return;
    lastSentRef.current = now;

    let myVehicle = vehicleCache[user.id];
    if (!myVehicle) {
        myVehicle = (await fetchVehicleStatus(user.id)) || { has_vehicle: false };
    }

    await supabase.from('stream_messages').insert({
        stream_id: streamId,
        user_id: user.id,
        content: content.trim(),
        user_name: profile.username,
        user_avatar: profile.avatar_url,
        user_role: profile.role,
        user_troll_role: profile.troll_role,
        user_created_at: profile.created_at,
        vehicle_snapshot: myVehicle
    });
  };

  return { messages, sendMessage };
}
