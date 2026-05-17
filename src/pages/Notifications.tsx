import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Virtuoso } from 'react-virtuoso'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Car,
  Check,
  CheckCircle,
  CircleDollarSign,
  Clock,
  Dot,
  FileText,
  Gift,
  Gavel,
  Megaphone,
  MessageCircle,
  Radio,
  Shield,
  ShoppingBag,
  Siren,
  Trash2,
  User,
  Video,
  X,
} from 'lucide-react'

import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { getGlowingTextStyle } from '@/lib/perkEffects'
import { cn } from '../lib/utils'

type NotificationPriority = 'low' | 'normal' | 'high' | 'critical'

type NotificationSource = 'notifications' | 'jail_notifications'

interface Notification {
  id: string
  source?: NotificationSource
  user_id?: string
  type: string
  title: string
  message: string
  created_at: string
  is_read: boolean
  is_dismissed?: boolean
  metadata?: any
  priority?: NotificationPriority
  admin_copy?: boolean
  category?: NotificationCategory
}

type NotificationCategory =
  | 'all'
  | 'admin'
  | 'moderation'
  | 'jail'
  | 'finance'
  | 'applications'
  | 'support'
  | 'broadcast'
  | 'social'
  | 'system'

const MAX_NOTIFICATIONS = 150
const REGULAR_NOTIFICATION_LIMIT = 120
const JAIL_NOTIFICATION_LIMIT = 40

const ADMIN_ROLES = new Set([
  'admin',
  'ceo',
  'owner',
  'super_admin',
  'moderator',
  'officer',
  'lead_troll_officer',
  'hr',
  'support',
])

function isAdminProfile(profile: any): boolean {
  const role = String(profile?.role || profile?.account_type || '').toLowerCase()
  return ADMIN_ROLES.has(role) || profile?.is_admin === true || profile?.is_staff === true
}

function isAdminCopy(metadata: any): boolean {
  return Boolean(
    metadata?.admin_copy ||
      metadata?.staff_copy ||
      metadata?.moderator_copy ||
      metadata?.officer_copy ||
      metadata?.audience === 'admin' ||
      metadata?.audience === 'staff'
  )
}

function normalizeType(type?: string) {
  return String(type || 'system').trim()
}

function getNotificationPriority(type: string, metadata?: any): NotificationPriority {
  if (metadata?.priority) return metadata.priority

  const criticalTypes = new Set([
    'security.alert',
    'moderation_alert',
    'report',
    'ban',
    'kick',
    'stream.ban',
    'stream.kick',
    'arrest',
    'sentencing',
    'jail_sentence',
    'support_ticket',
    'payout_request',
    'manual_coin_order',
    'coins.manual_purchase',
    'system.warning',
  ])

  const highTypes = new Set([
    'application_submitted',
    'officer_clock_in',
    'officer_clock_out',
    'bond_request',
    'appeal_submitted',
    'court_summon',
    'marketplace_order_fulfillment_required',
  ])

  if (criticalTypes.has(type)) return 'critical'
  if (highTypes.has(type)) return 'high'
  return 'normal'
}

function getNotificationCategory(type: string, metadata?: any): NotificationCategory {
  if (isAdminCopy(metadata)) return 'admin'

  if (
    [
      'moderation_alert',
      'moderation_action',
      'kick',
      'ban',
      'mute',
      'report',
      'stream.kick',
      'stream.ban',
      'security.alert',
    ].includes(type)
  ) {
    return 'moderation'
  }

  if (
    [
      'arrest',
      'sentencing',
      'release',
      'jail_sentence',
      'bond_request',
      'bond_posted',
      'court_summon',
      'attorney_hired',
      'court_date',
      'appeal_result',
      'appeal_submitted',
      'appeal_decision',
    ].includes(type)
  ) {
    return 'jail'
  }

  if (
    [
      'payout_status',
      'payout_request',
      'payout_update',
      'coins.fast_spend',
      'coins.manual_purchase',
      'manual_coin_order',
      'troll_post_gift',
      'gift_received',
      'coin_received',
      'coin_gifted',
    ].includes(type)
  ) {
    return 'finance'
  }

  if (
    [
      'application_submitted',
      'application_result',
      'trollg_application',
    ].includes(type)
  ) {
    return 'applications'
  }

  if (['support_ticket', 'support_reply'].includes(type)) return 'support'

  if (
    [
      'stream_live',
      'broadcast_live',
      'pod_live',
      'user_live',
      'followed_user_live',
      'join_approved',
      'battle_result',
    ].includes(type)
  ) {
    return 'broadcast'
  }

  if (['new_follower', 'message', 'message_received'].includes(type)) return 'social'

  return 'system'
}

function buildAdminSafeJailMessage(jailNotification: any, isAdmin: boolean) {
  const metadata = jailNotification.data || jailNotification.metadata || {}
  const inmateName =
    metadata.inmate_username ||
    metadata.username ||
    metadata.target_username ||
    metadata.user_username ||
    metadata.display_name ||
    'A user'

  const rawType = normalizeType(jailNotification.notification_type || jailNotification.type)

  if (!isAdmin) {
    return {
      title: jailNotification.title || 'Jail Notification',
      message: jailNotification.message || 'You have a jail update.',
    }
  }

  if (isAdminCopy(metadata) || metadata.inmate_id || metadata.target_user_id) {
    if (rawType === 'jail_sentence' || rawType === 'sentencing') {
      return {
        title: 'User Sentenced',
        message: `${inmateName} was sentenced. Open the jail dashboard to review the case.`,
      }
    }

    if (rawType === 'arrest') {
      return {
        title: 'User Arrested',
        message: `${inmateName} was jailed. This is an admin alert, not a notice against your account.`,
      }
    }

    if (rawType === 'release') {
      return {
        title: 'User Released',
        message: `${inmateName} was released from jail.`,
      }
    }

    if (rawType === 'bond_request') {
      return {
        title: 'Bond Request Submitted',
        message: `${inmateName} submitted a bond request.`,
      }
    }

    if (rawType === 'appeal_submitted') {
      return {
        title: 'Jail Appeal Submitted',
        message: `${inmateName} submitted an appeal for review.`,
      }
    }

    return {
      title: jailNotification.title?.replace(/^You\b/i, inmateName) || 'Jail Admin Alert',
      message:
        jailNotification.message
          ?.replace(/\bYou have been jailed\b/i, `${inmateName} has been jailed`)
          ?.replace(/\bYou were jailed\b/i, `${inmateName} was jailed`)
          ?.replace(/\byour account\b/i, `${inmateName}'s account`) ||
        `${inmateName} has a jail update that needs review.`,
    }
  }

  return {
    title: jailNotification.title || 'Jail Notification',
    message: jailNotification.message || 'Jail notification received.',
  }
}

function normalizeRegularNotification(row: any): Notification {
  const type = normalizeType(row.type)
  const metadata = row.metadata || row.data || {}

  return {
    id: row.id,
    source: 'notifications',
    user_id: row.user_id,
    type,
    title: row.title || 'Notification',
    message: row.message || '',
    created_at: row.created_at,
    is_read: Boolean(row.is_read),
    is_dismissed: Boolean(row.is_dismissed),
    metadata,
    priority: getNotificationPriority(type, metadata),
    admin_copy: isAdminCopy(metadata),
    category: getNotificationCategory(type, metadata),
  }
}

function normalizeJailNotification(row: any, isAdmin: boolean): Notification {
  const metadata = row.data || row.metadata || {}
  const type = normalizeType(row.notification_type || row.type || 'jail_sentence')
  const safeCopy = buildAdminSafeJailMessage(row, isAdmin)
  const adminCopy = isAdminCopy(metadata) || Boolean(metadata.inmate_id || metadata.target_user_id)

  return {
    id: row.id,
    source: 'jail_notifications',
    user_id: row.user_id,
    type,
    title: safeCopy.title,
    message: safeCopy.message,
    created_at: row.created_at,
    is_read: Boolean(row.is_read),
    is_dismissed: false,
    metadata,
    priority: getNotificationPriority(type, metadata),
    admin_copy: adminCopy,
    category: adminCopy && isAdmin ? 'admin' : getNotificationCategory(type, metadata),
  }
}

export default function Notifications() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<NotificationCategory>('all')
  const [loading, setLoading] = useState(true)

  const isAdmin = useMemo(() => isAdminProfile(profile), [profile])

  const loadNotifications = useCallback(async () => {
    if (!profile?.id) return

    setLoading(true)

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', profile.id)
        .lt('created_at', thirtyDaysAgo)

      const { data: regularRows, error: regularError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(REGULAR_NOTIFICATION_LIMIT)

      if (regularError) throw regularError

      const { data: jailRows, error: jailError } = await supabase
        .from('jail_notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(JAIL_NOTIFICATION_LIMIT)

      if (jailError) {
        console.warn('Unable to load jail_notifications:', jailError)
      }

      const regularNotifications = (regularRows || []).map(normalizeRegularNotification)
      const jailNotifications = (jailRows || []).map((row) =>
        normalizeJailNotification(row, isAdmin)
      )

      const combined = [...regularNotifications, ...jailNotifications]
        .filter((n) => !n.is_dismissed)
        .sort((a, b) => {
          const priorityScore: Record<NotificationPriority, number> = {
            critical: 4,
            high: 3,
            normal: 2,
            low: 1,
          }

          const priorityDelta =
            priorityScore[b.priority || 'normal'] - priorityScore[a.priority || 'normal']

          if (priorityDelta !== 0 && !a.is_read && !b.is_read) return priorityDelta

          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        .slice(0, MAX_NOTIFICATIONS)

      setNotifications(combined)
    } catch (error) {
      console.error('Failed to load notifications:', error)
      setNotifications([])
      toast.error('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [profile?.id, isAdmin])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!profile?.id) return

    const interval = window.setInterval(() => {
      void loadNotifications()
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [profile?.id, loadNotifications])

  const counts = useMemo(() => {
    const base: Record<NotificationCategory, number> = {
      all: notifications.length,
      admin: 0,
      moderation: 0,
      jail: 0,
      finance: 0,
      applications: 0,
      support: 0,
      broadcast: 0,
      social: 0,
      system: 0,
    }

    for (const notification of notifications) {
      const category = notification.category || 'system'
      base[category] = (base[category] || 0) + 1
    }

    return base
  }, [notifications])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  )

  const criticalCount = useMemo(
    () => notifications.filter((n) => !n.is_read && n.priority === 'critical').length,
    [notifications]
  )

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications
    return notifications.filter((n) => n.category === filter)
  }, [notifications, filter])

  const markAsRead = async (notification: Notification) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      )

      const table = notification.source === 'jail_notifications' ? 'jail_notifications' : 'notifications'

      const { error } = await supabase
        .from(table)
        .update({ is_read: true })
        .eq('id', notification.id)

      if (error) throw error
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
      toast.error('Failed to mark as read')
      void loadNotifications()
    }
  }

  const markAllAsRead = async () => {
    if (!profile?.id) return

    try {
      const { error: regularError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)

      if (regularError) throw regularError

      const { error: jailError } = await supabase
        .from('jail_notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)

      if (jailError) console.warn('Could not mark jail notifications read:', jailError)

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Failed to mark all as read:', error)
      toast.error('Error marking all as read')
    }
  }

  const dismissNotification = async (notification: Notification) => {
    try {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id))

      if (notification.source === 'jail_notifications') {
        const { error } = await supabase
          .from('jail_notifications')
          .update({ is_read: true })
          .eq('id', notification.id)

        if (error) throw error

        toast.success('Jail notification dismissed')
        return
      }

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notification.id)

      if (error) throw error

      toast.success('Notification deleted')
    } catch (error) {
      console.error('Failed to dismiss notification:', error)
      toast.error('Failed to dismiss notification')
      void loadNotifications()
    }
  }

  const deleteAllNotifications = async () => {
    if (!profile?.id) return

    const confirmed = window.confirm(
      'Clear all regular notifications? Jail notifications will only be marked as read for audit safety.'
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', profile.id)

      if (error) throw error

      await supabase
        .from('jail_notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)

      setNotifications([])
      toast.success('Notifications cleared')
    } catch (error) {
      console.error('Failed to clear notifications:', error)
      toast.error('Failed to clear notifications')
    }
  }

  const getDefaultRouteForType = (type: string, metadata?: any): string => {
    if (metadata?.route) return metadata.route
    if (metadata?.action_url) return metadata.action_url

    if (isAdminCopy(metadata)) {
      if (metadata?.admin_route) return metadata.admin_route
      if (metadata?.inmate_id) return `/inmates?inmate=${metadata.inmate_id}`
      if (metadata?.target_user_id) return `/admin/users?id=${metadata.target_user_id}`
    }

    switch (type) {
      case 'new_follower':
        return metadata?.follower_username ? `/profile/${metadata.follower_username}` : '/profile'

      case 'gift_received':
      case 'coin_received':
      case 'coin_gifted':
        return '/wallet'

      case 'message':
        return '/messages'

      case 'message_received':
        return '/tcps'

      case 'stream_live':
      case 'broadcast_live':
      case 'pod_live':
      case 'user_live':
      case 'followed_user_live':
        return metadata?.stream_id ? `/broadcast/${metadata.stream_id}` : '/broadcasts'

      case 'join_approved':
        return metadata?.stream_id ? `/broadcast/${metadata.stream_id}` : '/broadcasts'

      case 'vehicle_auction':
        return '/marketplace'

      case 'property_purchased':
        return '/profile?tab=properties'

      case 'item_purchased':
      case 'marketplace_order_created':
      case 'marketplace_order_shipped':
      case 'marketplace_order_delivered':
      case 'marketplace_order_updated':
        return metadata?.order_id ? `/my-orders?order=${metadata.order_id}` : '/my-orders'

      case 'marketplace_sale':
      case 'marketplace_order_fulfillment_required':
        return metadata?.order_id ? `/seller/orders?order=${metadata.order_id}` : '/seller/orders'

      case 'kick':
      case 'ban':
      case 'mute':
      case 'report':
      case 'moderation_alert':
      case 'moderation_action':
      case 'stream.kick':
      case 'stream.ban':
      case 'security.alert':
        return metadata?.case_id
          ? `/admin/moderation?case=${metadata.case_id}`
          : '/admin/moderation'

      case 'arrest':
      case 'sentencing':
      case 'jail_sentence':
      case 'bond_request':
      case 'bond_posted':
      case 'release':
        return metadata?.inmate_id ? `/inmates?inmate=${metadata.inmate_id}` : '/inmates'

      case 'court_summon':
      case 'attorney_hired':
      case 'court_date':
      case 'appeal_result':
      case 'appeal_submitted':
      case 'appeal_decision':
        return metadata?.case_id ? `/attorney?case=${metadata.case_id}` : '/attorney'

      case 'officer_update':
      case 'officer_clock_in':
      case 'officer_clock_out':
        return '/admin/officers'

      case 'payout_status':
      case 'payout_request':
      case 'payout_update':
        return metadata?.payout_id
          ? `/admin/finance?tab=payouts&id=${metadata.payout_id}`
          : '/admin/finance'

      case 'coins.fast_spend':
      case 'coins.manual_purchase':
      case 'manual_coin_order':
      case 'troll_post_gift':
        return metadata?.order_id
          ? `/admin/finance?tab=orders&id=${metadata.order_id}`
          : '/admin/finance'

      case 'support_ticket':
      case 'support_reply':
        return metadata?.ticket_id ? `/admin/support?id=${metadata.ticket_id}` : '/admin/support'

      case 'application_submitted':
      case 'application_result':
      case 'trollg_application':
        return metadata?.application_id
          ? `/admin/applications?id=${metadata.application_id}`
          : '/admin/applications'

      case 'seller_tier_upgraded':
      case 'seller_tier_downgraded':
      case 'new_review_received':
        return '/marketplace'

      case 'battle_result':
      case 'badge_unlocked':
        return '/profile'

      case 'announcement':
      case 'system':
      case 'system.warning':
      case 'system_announcement':
      default:
        return '/'
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    const route = getDefaultRouteForType(notification.type, notification.metadata)

    if (!notification.is_read) {
      void markAsRead(notification)
    }

    navigate(route)
  }

  const getNotificationIcon = (notification: Notification) => {
    const type = notification.type
    const category = notification.category

    if (notification.priority === 'critical') {
      return <Siren className="h-5 w-5 text-red-300" />
    }

    if (category === 'admin') return <Shield className="h-5 w-5 text-cyan-300" />

    switch (type) {
      case 'stream_live':
      case 'broadcast_live':
      case 'pod_live':
      case 'user_live':
      case 'followed_user_live':
        return <Video className="h-5 w-5 text-pink-300" />

      case 'join_approved':
        return <CheckCircle className="h-5 w-5 text-emerald-300" />

      case 'moderation_alert':
      case 'moderation_action':
      case 'kick':
      case 'ban':
      case 'mute':
      case 'report':
      case 'stream.kick':
      case 'stream.ban':
        return <Gavel className="h-5 w-5 text-red-300" />

      case 'arrest':
      case 'sentencing':
      case 'jail_sentence':
      case 'bond_request':
      case 'bond_posted':
      case 'release':
      case 'court_summon':
      case 'attorney_hired':
      case 'court_date':
        return <Gavel className="h-5 w-5 text-amber-300" />

      case 'new_follower':
        return <User className="h-5 w-5 text-blue-300" />

      case 'gift_received':
      case 'troll_post_gift':
        return <Gift className="h-5 w-5 text-fuchsia-300" />

      case 'message':
      case 'message_received':
      case 'support_ticket':
      case 'support_reply':
        return <MessageCircle className="h-5 w-5 text-cyan-300" />

      case 'announcement':
      case 'system_announcement':
        return <Megaphone className="h-5 w-5 text-orange-300" />

      case 'vehicle_auction':
        return <Car className="h-5 w-5 text-purple-300" />

      case 'officer_update':
      case 'officer_clock_in':
      case 'officer_clock_out':
        return <Shield className="h-5 w-5 text-cyan-300" />

      case 'application_submitted':
      case 'application_result':
      case 'trollg_application':
        return <Briefcase className="h-5 w-5 text-emerald-300" />

      case 'property_purchased':
      case 'item_purchased':
      case 'marketplace_order_created':
      case 'marketplace_sale':
        return <ShoppingBag className="h-5 w-5 text-green-300" />

      case 'coins.fast_spend':
      case 'coins.manual_purchase':
      case 'manual_coin_order':
      case 'payout_status':
      case 'payout_request':
      case 'payout_update':
        return <CircleDollarSign className="h-5 w-5 text-green-300" />

      case 'security.alert':
      case 'system.warning':
        return <AlertTriangle className="h-5 w-5 text-red-300" />

      default:
        return <Bell className="h-5 w-5 text-slate-300" />
    }
  }

  const renderMessage = (notification: Notification) => {
    if (notification.type === 'gift_received' && notification.metadata?.sender_username) {
      return (
        <>
          You received {Number(notification.metadata.coins_spent || 0).toLocaleString()} coins from{' '}
          <span
            style={getGlowingTextStyle(notification.metadata.sender_glowing_color)}
            className={notification.metadata.sender_glowing_color ? 'font-bold' : ''}
          >
            @{notification.metadata.sender_username}
          </span>
        </>
      )
    }

    return notification.message
  }

  const filterTabs: Array<{ key: NotificationCategory; label: string; icon: React.ReactNode }> = [
    { key: 'all', label: 'All', icon: <Bell className="h-4 w-4" /> },
    { key: 'admin', label: 'Admin', icon: <Shield className="h-4 w-4" /> },
    { key: 'moderation', label: 'Moderation', icon: <Gavel className="h-4 w-4" /> },
    { key: 'jail', label: 'Jail', icon: <FileText className="h-4 w-4" /> },
    { key: 'finance', label: 'Finance', icon: <CircleDollarSign className="h-4 w-4" /> },
    { key: 'applications', label: 'Applications', icon: <Briefcase className="h-4 w-4" /> },
    { key: 'support', label: 'Support', icon: <MessageCircle className="h-4 w-4" /> },
    { key: 'broadcast', label: 'Broadcast', icon: <Radio className="h-4 w-4" /> },
    { key: 'social', label: 'Social', icon: <User className="h-4 w-4" /> },
    { key: 'system', label: 'System', icon: <AlertTriangle className="h-4 w-4" /> },
  ]

  const renderNotification = (_index: number, notification: Notification) => {
    const isCritical = notification.priority === 'critical'
    const isHigh = notification.priority === 'high'
    const isAdminAlert = notification.category === 'admin'

    return (
      <div className="pb-3 pr-1">
        <article
          onClick={() => handleNotificationClick(notification)}
          className={cn(
            'group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl',
            isCritical
              ? 'border-red-400/45 bg-red-950/35 shadow-[0_0_30px_rgba(239,68,68,0.16)]'
              : isHigh
                ? 'border-amber-400/35 bg-amber-950/20 shadow-[0_0_24px_rgba(251,191,36,0.1)]'
                : isAdminAlert
                  ? 'border-cyan-300/35 bg-cyan-950/20 shadow-[0_0_28px_rgba(34,211,238,0.12)]'
                  : notification.is_read
                    ? 'border-white/10 bg-slate-950/55 hover:border-white/20'
                    : 'border-cyan-300/25 bg-slate-900/75 shadow-[0_0_24px_rgba(34,211,238,0.08)]'
          )}
        >
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.08),transparent_34%)]" />

          {!notification.is_read && (
            <div className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.85)]" />
          )}

          <div className="relative flex items-start gap-4">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-xl',
                isCritical
                  ? 'border-red-300/40 bg-red-500/15'
                  : isHigh
                    ? 'border-amber-300/35 bg-amber-500/15'
                    : isAdminAlert
                      ? 'border-cyan-300/35 bg-cyan-400/15'
                      : 'border-white/10 bg-white/5'
              )}
            >
              {getNotificationIcon(notification)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3
                      className={cn(
                        'truncate font-bold',
                        notification.is_read ? 'text-slate-300' : 'text-white'
                      )}
                    >
                      {notification.title}
                    </h3>

                    {notification.admin_copy && (
                      <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                        Admin Alert
                      </span>
                    )}

                    {isCritical && (
                      <span className="rounded-full border border-red-300/30 bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-red-200">
                        Critical
                      </span>
                    )}

                    {isHigh && !isCritical && (
                      <span className="rounded-full border border-amber-300/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                        High
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      'line-clamp-2 text-sm leading-relaxed',
                      notification.is_read ? 'text-slate-500' : 'text-slate-300'
                    )}
                  >
                    {renderMessage(notification)}
                  </p>
                </div>

                <time className="shrink-0 text-xs text-slate-500">
                  {new Date(notification.created_at).toLocaleDateString()}
                </time>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-cyan-300/85">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-slate-600">•</span>
                  <span>Click to open</span>
                </div>

                <div
                  className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification)}
                      className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-emerald-300/35 hover:bg-emerald-400/10 hover:text-emerald-200"
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => dismissNotification(notification)}
                    className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-red-300/35 hover:bg-red-400/10 hover:text-red-200"
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050714] px-4 pb-8 pt-24 text-white md:px-8">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.14),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-6 overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/70 p-5 shadow-[0_0_45px_rgba(34,211,238,0.12)] backdrop-blur-2xl md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 shadow-[0_0_26px_rgba(34,211,238,0.18)]">
                  <Bell className="h-6 w-6 text-cyan-200" />
                </div>

                <div>
                  <h1 className="bg-gradient-to-r from-cyan-200 via-fuchsia-200 to-cyan-300 bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl">
                    Trollifications
                  </h1>
                  <p className="text-sm text-slate-400">
                    Admin alerts, user updates, finance events, jail actions, and system notices.
                  </p>
                </div>
              </div>

              {isAdmin && (
                <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 px-4 py-3 text-sm text-cyan-100/85">
                  Admin jail notices are rewritten as staff alerts, so you will not see “you were jailed”
                  unless your own account was actually jailed.
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-2xl font-black text-white">{notifications.length}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Total</p>
              </div>

              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-3 text-center">
                <p className="text-2xl font-black text-cyan-200">{unreadCount}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Unread</p>
              </div>

              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-3 text-center">
                <p className="text-2xl font-black text-red-200">{criticalCount}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Critical</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={markAllAsRead}
                disabled={notifications.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCircle className="h-4 w-4" />
                Mark all read
              </button>

              <button
                onClick={deleteAllNotifications}
                disabled={notifications.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-red-300/25 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="h-4 w-4" />
                Clear all
              </button>
            </div>
          </div>
        </header>

        <nav className="mb-5 flex gap-2 overflow-x-auto pb-2">
          {filterTabs.map((tab) => {
            const active = filter === tab.key
            const count = counts[tab.key] || 0

            if (!isAdmin && ['admin', 'applications', 'support'].includes(tab.key)) return null

            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition',
                  active
                    ? 'border-cyan-300/40 bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.22)]'
                    : 'border-white/10 bg-slate-950/70 text-slate-400 hover:border-cyan-300/25 hover:text-white'
                )}
              >
                {tab.icon}
                {tab.label}
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px]',
                    active ? 'bg-slate-950/15 text-slate-950' : 'bg-white/5 text-slate-500'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </nav>

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/55 p-3 shadow-2xl backdrop-blur-xl">
          {loading ? (
            <div className="flex min-h-[380px] items-center justify-center text-slate-500">
              <div className="text-center">
                <Bell className="mx-auto mb-3 h-10 w-10 animate-pulse text-cyan-300/50" />
                Loading notifications...
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex min-h-[380px] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                  <Bell className="h-8 w-8 text-slate-600" />
                </div>
                <p className="text-lg font-bold text-slate-300">No notifications found</p>
                <p className="mt-1 text-sm text-slate-500">
                  {filter === 'all'
                    ? 'You are all caught up.'
                    : `No ${filter} notifications right now.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-[calc(100vh-360px)] min-h-[420px]">
              <Virtuoso
                style={{ height: '100%' }}
                data={filteredNotifications}
                itemContent={renderNotification}
                increaseViewportBy={300}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}