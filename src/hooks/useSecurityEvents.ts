import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';

export type SecurityEvent = {
  id: string;
  event_type: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'ignored' | 'false_positive';
  user_id: string | null;
  actor_id: string | null;
  target_user_id: string | null;
  stream_id: string | null;
  agency_id: string | null;
  cashout_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  route: string | null;
  source: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  risk_score: number;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RiskScore = {
  id: string;
  user_id: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  failed_login_count: number;
  suspicious_action_count: number;
  last_event_at: string | null;
  last_ip_address: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

type UseSecurityEventsReturn = {
  events: SecurityEvent[];
  riskScores: RiskScore[];
  loading: boolean;
  error: Error | null;
  filters: {
    severity: string[];
    status: string[];
    event_type: string[];
    user_id: string | null;
    search: string;
  };
  setFilters: (filters: Partial<UseSecurityEventsReturn['filters']>) => void;
  refresh: () => Promise<void>;
  resolveEvent: (eventId: string, status: SecurityEvent['status'], note?: string) => Promise<void>;
  markFalsePositive: (eventId: string) => Promise<void>;
  ignoreEvent: (eventId: string) => Promise<void>;
};

export const useSecurityEvents = (): UseSecurityEventsReturn => {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<UseSecurityEventsReturn['filters']>({
    severity: [],
    status: [],
    event_type: [],
    user_id: null,
    search: '',
  });

  // Fetch security events and risk scores
  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch security events with filters
      let eventsQuery = supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.severity.length > 0) {
        eventsQuery = eventsQuery.in('severity', filters.severity);
      }
      if (filters.status.length > 0) {
        eventsQuery = eventsQuery.in('status', filters.status);
      }
      if (filters.event_type.length > 0) {
        eventsQuery = eventsQuery.in('event_type', filters.event_type);
      }
      if (filters.user_id) {
        eventsQuery = eventsQuery.eq('user_id', filters.user_id);
      }
      if (filters.search) {
        // Search in title and description
        eventsQuery = eventsQuery.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data: eventsData, error: eventsError } = await eventsQuery;

      if (eventsError) throw eventsError;

      // Fetch risk scores
      const { data: riskScoresData, error: riskScoresError } = await supabase
        .from('security_user_risk_scores')
        .select('*')
        .order('risk_score', { ascending: false });

      if (riskScoresError) throw riskScoresError;

      setEvents(eventsData || []);
      setRiskScores(riskScoresData || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Failed to fetch security events:', err);
    } finally {
      setLoading(false);
    }
  }, [user, filters.severity, filters.status, filters.event_type, filters.user_id, filters.search]);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for security events
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('security-events-changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'security_events' },
        (payload) => {
          setEvents((prev) => [payload.new as SecurityEvent, ...prev]);
        }
      )
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'security_events' },
        (payload) => {
          setEvents((prev) => 
            prev.map((event) => 
              event.id === payload.new.id ? (payload.new as SecurityEvent) : event
            )
          );
        }
      )
      .subscribe();

    // Also subscribe to risk score updates
    const riskChannel = supabase
      .channel('security-risk-scores-changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'security_user_risk_scores' },
        (payload) => {
          setRiskScores((prev) => 
            prev.map((score) => 
              score.user_id === (payload.new as RiskScore).user_id ? (payload.new as RiskScore) : score
            )
          );
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'security_user_risk_scores' },
        (payload) => {
          setRiskScores((prev) => [payload.new as RiskScore, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(riskChannel);
    };
  }, [user]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const resolveEvent = async (eventId: string, status: SecurityEvent['status'], note: string = null) => {
    try {
      const { error } = await supabase.rpc('resolve_security_event', {
        p_event_id: eventId,
        p_status: status,
        p_note: note,
      });

      if (error) throw error;
      
      // Refetch to get updated data
      await refresh();
    } catch (err) {
      throw err;
    }
  };

  const markFalsePositive = async (eventId: string) => {
    await resolveEvent(eventId, 'false_positive', 'Marked as false positive via Security Command Center');
  };

  const ignoreEvent = async (eventId: string) => {
    await resolveEvent(eventId, 'ignored', 'Ignored via Security Command Center');
  };

  return {
    events,
    riskScores,
    loading,
    error,
    filters,
    setFilters,
    refresh,
    resolveEvent,
    markFalsePositive,
    ignoreEvent,
  };
};