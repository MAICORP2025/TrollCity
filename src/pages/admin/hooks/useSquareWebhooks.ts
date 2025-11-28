import { useState, useEffect } from 'react';
import api from '../../../lib/api';

interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created_at: string;
}

export const useSquareWebhooks = (): WebhookEvent[] => {
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  const loadEvents = async () => {
    const response = await api.get('/payments/status');
    setEvents(response?.events || []);
  };

  useEffect(() => {
    loadEvents();

    // Poll for new events every 30 seconds
    const interval = setInterval(loadEvents, 30000);

    return () => clearInterval(interval);
  }, []);

  return events;
};