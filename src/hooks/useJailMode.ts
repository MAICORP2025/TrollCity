import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useJailMode(userId: string | undefined) {
  const [isJailed, setIsJailed] = useState(false);
  const [releaseTime, setReleaseTime] = useState<string | null>(null);
  const [jailTimeRemaining, setJailTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsJailed(false);
      return;
    }

    const checkJailStatus = async () => {
      const { data, error } = await supabase
        .from('jail')
        .select('release_time')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching jail status:', error);
        setIsJailed(false);
        return;
      }

      const jailRecord = data?.[0];

      if (jailRecord && jailRecord.release_time) {
        const releaseDate = new Date(jailRecord.release_time);
        if (releaseDate > new Date()) {
          setIsJailed(true);
          setReleaseTime(jailRecord.release_time);
        } else {
          setIsJailed(false);
          setReleaseTime(null);
        }
      } else {
        setIsJailed(false);
        setReleaseTime(null);
      }
    };

    checkJailStatus();

    const subscription = supabase
      .channel(`jail:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jail',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('Jail status change detected, refetching...');
          checkJailStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId]);

  useEffect(() => {
    if (isJailed && releaseTime) {
      const interval = setInterval(() => {
        const now = new Date();
        const release = new Date(releaseTime);
        const remaining = release.getTime() - now.getTime();
        
        if (remaining > 0) {
          setJailTimeRemaining(remaining);
        } else {
          setJailTimeRemaining(0);
          setIsJailed(false);
          setReleaseTime(null);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isJailed, releaseTime]);

  return { isJailed, jailTimeRemaining, releaseTime };
}
