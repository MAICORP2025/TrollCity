import { supabaseClient } from '../lib/supabaseClient';
import { getCurrentUser } from '../services/authService';
import { User, Video, UnlockedContent, CoinTransaction, CreatorApplication, PayoutRequest } from '../types';

interface Auth {
  me(): Promise<User | null>;
  updateMe(data: Partial<User>): Promise<void>;
  logout(): Promise<void>;
  redirectToLogin(): void;
}

interface QueryFilter {
  [key: string]: unknown;
  neq?: { field: string; value: unknown };
}

interface VideoEntity {
  filter(query?: QueryFilter, sort?: string, limit?: number): Promise<Video[]>;
  list(sort?: string, limit?: number): Promise<Video[]>;
  update(id: string, data: Partial<Video>): Promise<void>;
}

interface UnlockedContentEntity {
  filter(query?: QueryFilter): Promise<UnlockedContent[]>;
  create(data: UnlockedContent): Promise<void>;
}

interface CoinTransactionEntity {
  filter(query?: QueryFilter, sort?: string, limit?: number): Promise<CoinTransaction[]>;
  create(data: CoinTransaction): Promise<void>;
}

interface UserEntity {
  filter(query?: QueryFilter): Promise<User[]>;
  list(sort?: string, limit?: number): Promise<User[]>;
  update(id: string, data: Partial<User>): Promise<void>;
}

interface CreatorApplicationEntity {
  filter(query?: QueryFilter, sort?: string, limit?: number): Promise<CreatorApplication[]>;
  update(id: string, data: Partial<CreatorApplication>): Promise<void>;
}

interface PayoutRequestEntity {
  filter(query?: QueryFilter, sort?: string, limit?: number): Promise<PayoutRequest[]>;
  update(id: string, data: Partial<PayoutRequest>): Promise<void>;
}

interface Entities {
  Video: VideoEntity;
  UnlockedContent: UnlockedContentEntity;
  CoinTransaction: CoinTransactionEntity;
  User: UserEntity;
  CreatorApplication: CreatorApplicationEntity;
  PayoutRequest: PayoutRequestEntity;
}

interface SupabaseAPI {
  auth: Auth;
  entities: Entities;
}

const supabaseApi: SupabaseAPI = {
  auth: {
    async me(): Promise<User | null> {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userData.id)
            .single();
          return { ...userData, ...profile };
        }
        return null;
      } catch {
        return null;
      }
    },
    async updateMe(data: Partial<User>): Promise<void> {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabaseClient
        .from('profiles')
        .update(data)
        .eq('id', user.id);
      if (error) throw error;
    },
    async logout(): Promise<void> {
      await supabaseClient.auth.signOut();
    },
    redirectToLogin(): void {
      window.location.href = '/login';
    }
  },
  entities: {
    Video: {
      async filter(query?: Record<string, unknown>, sort = '', limit?: number): Promise<Video[]> {
        let qb = supabaseClient.from('videos').select('*');
        if (query) {
          Object.entries(query).forEach(([key, value]) => {
            if (key === 'neq') {
              const neqValue = value as { field: string; value: unknown };
              qb = qb.neq(neqValue.field, neqValue.value);
            } else {
              qb = qb.eq(key, value);
            }
          });
        }
        if (sort) {
          if (sort.startsWith('-')) {
            qb = qb.order(sort.slice(1), { ascending: false });
          } else {
            qb = qb.order(sort, { ascending: true });
          }
        }
        if (limit) {
          qb = qb.limit(limit);
        }
        const { data, error } = await qb;
        if (error) throw error;
        return data as Video[];
      },
      async list(sort = '', limit?: number): Promise<Video[]> {
        return this.filter({}, sort, limit);
      },
      async update(id: string, data: Partial<Video>): Promise<void> {
        const { error } = await supabaseClient
          .from('videos')
          .update(data)
          .eq('id', id);
        if (error) throw error;
      }
    },
    UnlockedContent: {
      async filter(query?: Record<string, unknown>): Promise<UnlockedContent[]> {
        let qb = supabaseClient.from('unlocked_content').select('*');
        if (query) {
          Object.entries(query).forEach(([key, value]) => {
            qb = qb.eq(key, value);
          });
        }
        const { data, error } = await qb;
        if (error) throw error;
        return data as UnlockedContent[];
      },
      async create(data: UnlockedContent): Promise<void> {
        const { error } = await supabaseClient
          .from('unlocked_content')
          .insert(data);
        if (error) throw error;
      }
    },
    CoinTransaction: {
      async filter(query?: Record<string, unknown>, sort = '', limit?: number): Promise<CoinTransaction[]> {
        let qb = supabaseClient.from('coin_transactions').select('*');
        if (query) {
          Object.entries(query).forEach(([key, value]) => {
            if (key === 'neq') {
              const neqValue = value as { field: string; value: unknown };
              qb = qb.neq(neqValue.field, neqValue.value);
            } else {
              qb = qb.eq(key, value);
            }
          });
        }
        if (sort) {
          if (sort.startsWith('-')) {
            qb = qb.order(sort.slice(1), { ascending: false });
          } else {
            qb = qb.order(sort, { ascending: true });
          }
        }
        if (limit) {
          qb = qb.limit(limit);
        }
        const { data, error } = await qb;
        if (error) throw error;
        return data as CoinTransaction[];
      },
      async create(data: CoinTransaction): Promise<void> {
        const { error } = await supabaseClient
          .from('coin_transactions')
          .insert(data);
        if (error) throw error;
      }
    },
    User: {
      async filter(query?: Record<string, unknown>): Promise<User[]> {
        let qb = supabaseClient.from('profiles').select('*');
        if (query) {
          Object.entries(query).forEach(([key, value]) => {
            qb = qb.eq(key, value);
          });
        }
        const { data, error } = await qb;
        if (error) throw error;
        return data as User[];
      },
      async list(sort = '', limit?: number): Promise<User[]> {
        let qb = supabaseClient.from('profiles').select('*');
        if (sort) {
          if (sort.startsWith('-')) {
            qb = qb.order(sort.slice(1), { ascending: false });
          } else {
            qb = qb.order(sort, { ascending: true });
          }
        }
        if (limit) {
          qb = qb.limit(limit);
        }
        const { data, error } = await qb;
        if (error) throw error;
        return data as User[];
      },
      async update(id: string, data: Partial<User>): Promise<void> {
        const { error } = await supabaseClient
          .from('profiles')
          .update(data)
          .eq('id', id);
        if (error) throw error;
      }
    },
    CreatorApplication: {
      async filter(query?: Record<string, unknown>, sort = '', limit?: number): Promise<CreatorApplication[]> {
        let qb = supabaseClient.from('creator_applications').select('*');
        if (query) {
          Object.entries(query).forEach(([key, value]) => {
            qb = qb.eq(key, value);
          });
        }
        if (sort) {
          if (sort.startsWith('-')) {
            qb = qb.order(sort.slice(1), { ascending: false });
          } else {
            qb = qb.order(sort, { ascending: true });
          }
        }
        if (limit) {
          qb = qb.limit(limit);
        }
        const { data, error } = await qb;
        if (error) throw error;
        return data as CreatorApplication[];
      },
      async update(id: string, data: Partial<CreatorApplication>): Promise<void> {
        const { error } = await supabaseClient
          .from('creator_applications')
          .update(data)
          .eq('id', id);
        if (error) throw error;
      }
    },
    PayoutRequest: {
      async filter(query?: Record<string, unknown>, sort = '', limit?: number): Promise<PayoutRequest[]> {
        let qb = supabaseClient.from('payout_requests').select('*');
        if (query) {
          Object.entries(query).forEach(([key, value]) => {
            qb = qb.eq(key, value);
          });
        }
        if (sort) {
          if (sort.startsWith('-')) {
            qb = qb.order(sort.slice(1), { ascending: false });
          } else {
            qb = qb.order(sort, { ascending: true });
          }
        }
        if (limit) {
          qb = qb.limit(limit);
        }
        const { data, error } = await qb;
        if (error) throw error;
        return data as PayoutRequest[];
      },
      async update(id: string, data: Partial<PayoutRequest>): Promise<void> {
        const { error } = await supabaseClient
          .from('payout_requests')
          .update(data)
          .eq('id', id);
        if (error) throw error;
      }
    }
  }
};

export { supabaseApi };