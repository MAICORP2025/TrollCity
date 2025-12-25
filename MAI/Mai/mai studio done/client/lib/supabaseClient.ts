import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials not found. Check .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types for MAI Studios database tables
export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  is_creator: boolean;
  is_admin: boolean;
  coin_balance: number;
  vip_status?: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
  total_earnings: number;
  followers_count: number;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  creator_id: string;
  series_id?: string;
  title: string;
  description?: string;
  content_type: 'short' | 'movie';
  video_url: string;
  thumbnail_url?: string;
  duration: number;
  views: number;
  likes: number;
  featured: boolean;
  status: 'pending' | 'approved' | 'rejected';
  is_unlockable: boolean;
  unlock_price?: number;
  created_at: string;
  updated_at: string;
  series?: {
    id: string;
    name: string;
    description?: string;
  };
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  transaction_type: 'purchase' | 'send' | 'earn';
  amount: number;
  description?: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface VIPPackage {
  id: string;
  creator_id: string;
  name: string;
  description?: string;
  price: number;
  monthly_content_count: number;
  perks?: string[];
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  vip_package_id: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface PayoutRequest {
  id: string;
  creator_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'completed';
  requested_at: string;
  processed_at?: string;
}


// Auth helpers
export const getCurrentUser = async () => {
  // Placeholder - returns null for now
  // Will be replaced with actual Supabase auth
  return null;
};

export const signOut = async () => {
  // Placeholder
  console.log('Sign out called');
};

// Video queries
export const fetchVideos = async (_contentType: 'short' | 'movie' | 'all' = 'all') => {
  // TODO: Implement actual Supabase queries
  return [];
};

export const fetchFeaturedVideos = async () => {
  // TODO: Implement actual Supabase queries
  return [];
};

export const fetchTrendingShorts = async () => {
  // TODO: Implement actual Supabase queries
  return [];
};

export const fetchMovies = async () => {
  // TODO: Implement actual Supabase queries
  return [];
};

export const fetchVideoById = async (_id: string) => {
  // TODO: Implement actual Supabase queries
  throw new Error('Video not found');
};

// Profile queries
export const fetchProfile = async (userId: string) => {
  // Placeholder - returns mock profile
  return {
    id: userId,
    username: 'Creator User',
    bio: 'Welcome to MAI Studios',
    is_creator: true,
    is_admin: false,
    coin_balance: 50000,
    vip_status: 'gold' as const,
    total_earnings: 150000,
    followers_count: 25000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

export const fetchTopCreators = async (_limit = 10) => {
  // TODO: Implement actual Supabase queries
  return [];
};

// Initialize dark mode
if (typeof window !== 'undefined') {
  document.documentElement.classList.add('dark');
}
