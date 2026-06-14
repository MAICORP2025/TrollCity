import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface StorageBreakdown {
  category: string
  bytes: number
  label: string
}

export interface StoragePlan {
  tierIndex: number
  tierLabel: string
  monthlyFee: number
  bytesGranted: number | null
  isActive: boolean
  nextBillingAt: string
  lastPaymentAt: string | null
}

export interface StorageUsage {
  totalBytes: number
  totalGB: number
  breakdown: StorageBreakdown[]
  tierStart: number
  tierEnd: number
  tierStartGB: number
  tierEndGB: number
  monthlyFee: number
  percentage: number
  status: 'normal' | 'warning' | 'exceeded'
  plan: StoragePlan | null
}

const STORAGE_TIERS = [
  { start: 0, end: 10 * 1024 * 1024 * 1024, fee: 50, label: '0–10 GB' },
  { start: 10 * 1024 * 1024 * 1024, end: 25 * 1024 * 1024 * 1024, fee: 100, label: '10–25 GB' },
  { start: 25 * 1024 * 1024 * 1024, end: 50 * 1024 * 1024 * 1024, fee: 250, label: '25–50 GB' },
  { start: 50 * 1024 * 1024 * 1024, end: 100 * 1024 * 1024 * 1024, fee: 500, label: '50–100 GB' },
  { start: 100 * 1024 * 1024 * 1024, end: null, fee: 1000, label: '100 GB+' },
]

function getTierInfo(totalBytes: number) {
  for (const tier of STORAGE_TIERS) {
    if (tier.end === null || totalBytes < tier.end) {
      return tier
    }
  }
  return STORAGE_TIERS[STORAGE_TIERS.length - 1]
}

export function useStorageUsage(userId?: string | null) {
  const [storage, setStorage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStorageUsage = useCallback(async () => {
    if (!userId) {
      setStorage(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [breakdownRes, planRes] = await Promise.all([
        supabase.rpc('get_user_storage_breakdown', { p_user_id: userId }),
        supabase.rpc('get_user_storage_plan', { p_user_id: userId }),
      ])

      if (breakdownRes.error) throw breakdownRes.error

      const breakdown = (breakdownRes.data || []).map((row: any) => ({
        category: row.category,
        bytes: row.bytes || 0,
        label: row.category,
      }))

      const totalBytes = breakdown.reduce((sum: number, item: StorageBreakdown) => sum + item.bytes, 0)
      const tier = getTierInfo(totalBytes)
      const percentage = tier.end === null
        ? 100
        : Math.max(0, Math.min(99, ((totalBytes - tier.start) / (tier.end - tier.start)) * 100))

      const status: 'normal' | 'warning' | 'exceeded' = percentage >= 80 ? 'warning' : 'normal'

      const planRow = (planRes.data || [])[0]
      const plan: StoragePlan | null = planRow ? {
        tierIndex: planRow.tier_index,
        tierLabel: planRow.tier_label,
        monthlyFee: planRow.monthly_fee,
        bytesGranted: planRow.bytes_granted,
        isActive: planRow.is_active,
        nextBillingAt: planRow.next_billing_at,
        lastPaymentAt: planRow.last_payment_at,
      } : null

      setStorage({
        totalBytes,
        totalGB: totalBytes / (1024 * 1024 * 1024),
        breakdown,
        tierStart: tier.start,
        tierEnd: tier.end || Infinity,
        tierStartGB: tier.start / (1024 * 1024 * 1024),
        tierEndGB: tier.end ? tier.end / (1024 * 1024 * 1024) : Infinity,
        monthlyFee: tier.fee,
        percentage,
        status,
        plan,
      })
    } catch (err: any) {
      console.error('[useStorageUsage] Failed to fetch storage data:', err)
      setError(err?.message || 'Failed to load storage data')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchStorageUsage()

    if (!userId) return

    const channel = supabase
      .channel(`user-storage-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_streams',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchStorageUsage()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_storage_usage',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const record = payload.new as any
            if (record) {
              const totalBytes = record.total_bytes || 0
              const tier = getTierInfo(totalBytes)
              const percentage = tier.end === null
                ? 100
                : Math.max(0, Math.min(99, ((totalBytes - tier.start) / (tier.end - tier.start)) * 100))

              const plan: StoragePlan | null = record
                ? {
                    tierIndex: 0,
                    tierLabel: tier.label,
                    monthlyFee: tier.fee,
                    bytesGranted: tier.end,
                    isActive: true,
                    nextBillingAt: '',
                    lastPaymentAt: null,
                  }
                : null

              setStorage({
                totalBytes,
                totalGB: totalBytes / (1024 * 1024 * 1024),
                breakdown: [
                  { category: 'Broadcast Recordings', bytes: record.broadcast_recordings_bytes || 0, label: 'Broadcast Recordings' },
                  { category: 'Hytro Games Files', bytes: record.gaming_files_bytes || 0, label: 'Game Files' },
                  { category: 'Screenshots', bytes: record.screenshots_bytes || 0, label: 'Screenshots' },
                  { category: 'Videos', bytes: record.videos_bytes || 0, label: 'Videos' },
                  { category: 'Wall Media', bytes: record.wall_media_bytes || 0, label: 'Wall Media' },
                  { category: 'Profile Media', bytes: record.profile_media_bytes || 0, label: 'Profile Media' },
                  { category: 'Stream Thumbnails', bytes: record.thumbnails_bytes || 0, label: 'Stream Thumbnails' },
                  { category: 'Other', bytes: record.other_bytes || 0, label: 'Other' },
                ],
                tierStart: tier.start,
                tierEnd: tier.end || Infinity,
                tierStartGB: tier.start / (1024 * 1024 * 1024),
                tierEndGB: tier.end ? tier.end / (1024 * 1024 * 1024) : Infinity,
                monthlyFee: tier.fee,
                percentage,
                status: percentage >= 80 ? 'warning' : 'normal',
                plan,
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchStorageUsage])

  return { storage, loading, error, refresh: fetchStorageUsage }
}