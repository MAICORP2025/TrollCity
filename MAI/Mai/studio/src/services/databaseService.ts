import { supabaseClient } from '../lib/supabaseClient'
import type { Video, CoinTransaction } from '../types'

export const fetchUserProfile = async (userId: string) => {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export const updateUserProfile = async (userId: string, updates: Partial<Record<string, unknown>>) => {
  const { data, error } = await supabaseClient
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  return { data, error }
}

export const fetchVideos = async (): Promise<{ data: Video[] | null, error: unknown }> => {
  const { data, error } = await supabaseClient
    .from('videos')
    .select('*')
  return { data, error }
}

export const fetchVideoById = async (id: string): Promise<{ data: Video | null, error: unknown }> => {
  const { data, error } = await supabaseClient
    .from('videos')
    .select('*')
    .eq('id', id)
    .single()
  return { data, error }
}

export const updateVideo = async (id: string, updates: Partial<Video>): Promise<{ data: Video | null, error: unknown }> => {
  const { data, error } = await supabaseClient
    .from('videos')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export const deleteVideo = async (id: string): Promise<{ error: unknown }> => {
  const { error } = await supabaseClient
    .from('videos')
    .delete()
    .eq('id', id)
  return { error }
}

export const createCoinTransaction = async (transaction: Omit<CoinTransaction, 'status'> & { status?: CoinTransaction['status'] }): Promise<{ data: CoinTransaction | null, error: unknown }> => {
  const transactionData = { ...transaction, status: transaction.status || 'completed' }
  const { data, error } = await supabaseClient
    .from('coin_transactions')
    .insert(transactionData)
    .select()
    .single()
  return { data, error }
}

export const fetchCoinTransactions = async (userEmail: string): Promise<{ data: CoinTransaction[] | null, error: unknown }> => {
  const { data, error } = await supabaseClient
    .from('coin_transactions')
    .select('*')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
  return { data, error }
}

export const fetchAllCoinTransactions = async (): Promise<{ data: CoinTransaction[] | null, error: unknown }> => {
  const { data, error } = await supabaseClient
    .from('coin_transactions')
    .select('*')
    .order('created_at', { ascending: false })
  return { data, error }
}

export const updateCoinTransactionStatus = async (id: string, status: CoinTransaction['status']): Promise<{ data: CoinTransaction | null, error: unknown }> => {
  const { data, error } = await supabaseClient
    .from('coin_transactions')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// Add more functions as needed for coins, etc.