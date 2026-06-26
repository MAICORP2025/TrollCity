import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ShareAThonRestriction {
  restricted: boolean;
  loading: boolean;
  isEligible: boolean;
}

export function useShareAThonRestriction(userId: string | undefined): ShareAThonRestriction {
  const [restricted, setRestricted] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const checkRestriction = async () => {
      try {
        const { data: event, error: eventError } = await supabase
          .from('shareathon_events')
          .select('id, status, restrict_new_broadcasters, event_start_at')
          .in('status', ['waiting', 'active'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (eventError || !event) {
          setRestricted(false);
          setIsEligible(false);
          setLoading(false);
          return;
        }

        if (!event.restrict_new_broadcasters) {
          setRestricted(false);
          setIsEligible(false);
          setLoading(false);
          return;
        }

        const { data: eligibility } = await supabase
          .from('shareathon_eligible_broadcasters')
          .select('id, disqualified')
          .eq('event_id', event.id)
          .eq('user_id', userId)
          .maybeSingle();

        if (eligibility && !eligibility.disqualified) {
          setRestricted(false);
          setIsEligible(true);
        } else {
          setRestricted(true);
          setIsEligible(false);
        }
      } catch (err) {
        console.error('Error checking Share-A-Thon restriction:', err);
        setRestricted(false);
        setIsEligible(false);
      } finally {
        setLoading(false);
      }
    };

    checkRestriction();

    const channel = supabase
      .channel('shareathon_restriction_check')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shareathon_events'
      }, () => {
        checkRestriction();
      })
      .subscribe();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId]);

  return { restricted, loading, isEligible };
}

export default useShareAThonRestriction;
