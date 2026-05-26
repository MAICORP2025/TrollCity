// Tromail - Internal Role-Based Email System for Troll City

import { supabase } from './supabase'
import { createNotification } from './notifications'
import { UserRole } from './supabase'

// Type definitions for Tromail
export interface TromailAccount {
  id: string
  user_id: string
  role: string
  display_name: string | null
  email_address: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TromailMessage {
  id: string
  sender_user_id: string
  sender_role: string
  sender_tromail_address: string
  subject: string
  body: string
  is_admin_email: boolean
  is_important: boolean
  related_meeting_id: string | null
  created_at: string
  updated_at: string
}

export interface TromailRecipient {
  id: string
  message_id: string
  recipient_user_id: string
  recipient_role: string
  recipient_tromail_address: string
  read_at: string | null
  archived_at: string | null
  deleted_at: string | null
  is_starred: boolean
  created_at: string
}

export interface TromailCalendarEvent {
  id: string
  created_by_user_id: string
  created_by_role: string
  title: string
  description: string | null
  event_type: string
  starts_at: string
  ends_at: string | null
  meeting_id: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface TromailCalendarEventRecipient {
  id: string
  calendar_event_id: string
  recipient_user_id: string
  recipient_role: string
  created_at: string
}

// Approved roles for Tromail access
export const TRMAIL_APPROVED_ROLES = [
  'auctioneer',
  'prosecutor',
  'attorney',
  'tcnn_news_caster',
  'secretary',
  'tcnn_chief_news_caster',
  'troll_officer',
  'journalist',
  'lead_troll_officer',
  'troller',
  'agency_hr_manager',
  'agency_hr',
  'agency_leader',
  'troll_family_leader',
  'ceo_assistant',
  'noah_assistant',
  'admin',
  'noah_admin',
  'ceo',
  UserRole.ADMIN,
  UserRole.SECRETARY,
  UserRole.AGENCY_HR_MANAGER,
  UserRole.HR_ADMIN,
  UserRole.LEAD_TROLL_OFFICER,
  UserRole.TROLL_OFFICER,
  'ceo',
  'lead_officer',
  'troll_officer',
  'officer'
]

// Check if user can access Tromail
export const canAccessTromail = (profile: any): boolean => {
  if (!profile) return false
  const role = profile.role || profile.troll_role
  return (
    profile?.is_admin ||
    role === 'admin' ||
    role === 'ceo' ||
    profile?.is_ceo ||
    role === 'secretary' ||
    profile?.is_secretary ||
    role === 'prosecutor' ||
    profile?.is_prosecutor ||
    role === 'attorney' ||
    profile?.is_attorney ||
    role === 'auctioneer' ||
    profile?.is_auctioneer ||
    role === 'troll_officer' ||
    profile?.is_troll_officer ||
    role === 'lead_troll_officer' ||
    profile?.is_lead_officer ||
    role === 'troller' ||
    profile?.is_troller ||
    role === 'agency_hr_manager' ||
    role === 'agency_hr' ||
    role === 'agency_leader' ||
    role === 'troll_family_leader' ||
    role === 'ceo_assistant' ||
    role === 'noah_assistant' ||
    role === 'noah_admin' ||
    role === 'journalist' ||
    role === 'tcnn_news_caster' ||
    role === 'tcnn_chief_news_caster' ||
    !!profile?.organization_id
  )
}

// Check if user can send admin emails
export const canSendAdminEmail = (profile: any): boolean => {
  if (!profile) return false
  const role = profile.role || profile.troll_role
  return (
    profile?.is_admin ||
    role === 'admin' ||
    role === 'ceo' ||
    profile?.is_ceo ||
    role === 'admin_assistant' ||
    role === 'ceo_assistant' ||
    role === 'secretary' ||
    profile?.is_secretary
  )
}

// Generate Tromail address from role and username
export const generateTromailAddress = (role: string, username: string): string => {
  // Convert role to address format
  const roleSlug = role.toLowerCase().replace(/_/g, '-')
  return `${roleSlug}@tromail.trollcity`
}

// Create Tromail account for a user
export const createTromailAccount = async (
  userId: string,
  role: string,
  displayName: string
): Promise<{ success: boolean; address?: string; error?: string }> => {
  try {
    // Get username for the address
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('id', userId)
      .single()

    const username = profile?.username || 'user'
    const address = generateTromailAddress(role, username)

// Check for duplicate
     const { data: existing } = await supabase
      .from('tromail_accounts')
      .select('id')
      .eq('email_address', address)
      .single()

    if (existing) {
      // Try with username suffix
      const altAddress = `${role.toLowerCase().replace(/_/g, '-')}.${username.toLowerCase()}@tromail.trollcity`
      return await supabase.from('tromail_accounts').insert({
        user_id: userId,
        role,
        display_name: displayName,
        email_address: altAddress,
        is_active: true,
      }).select().single().then(({ data, error }) => {
        if (error) throw error
        return { success: true, address: altAddress }
      })
    }

    const { data, error } = await supabase
      .from('tromail_accounts')
      .insert({
        user_id: userId,
        role,
        display_name: displayName,
        email_address: address,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return { success: true, address }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create Tromail account' }
  }
}

// Get user's Tromail account
export const getUserTromailAccount = async (userId: string): Promise<TromailAccount | null> => {
  const { data, error } = await supabase
    .from('tromail_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data as TromailAccount
}

// Send Tromail message
export const sendTromailMessage = async (params: {
  sender_user_id: string
  sender_role: string
  sender_tromail_address: string
  subject: string
  body: string
  is_admin_email?: boolean
  is_important?: boolean
  related_meeting_id?: string | null
  recipient_user_ids: string[]
  recipient_roles: string[]
}): Promise<{ success: boolean; message_id?: string; error?: string }> => {
  try {
    // Create the message
    const { data: message, error: messageError } = await supabase
      .from('tromail_messages')
      .insert({
        sender_user_id: params.sender_user_id,
        sender_role: params.sender_role,
        sender_tromail_address: params.sender_tromail_address,
        subject: params.subject,
        body: params.body,
        is_admin_email: params.is_admin_email || false,
        is_important: params.is_important || false,
        related_meeting_id: params.related_meeting_id || null,
      })
      .select()
      .single()

    if (messageError) throw messageError

    // Create recipients
    const recipients = params.recipient_user_ids.map((userId, index) => ({
      message_id: message.id,
      recipient_user_id: userId,
      recipient_role: params.recipient_roles[index] || params.sender_role,
      recipient_tromail_address: params.sender_tromail_address,
    }))

    const { error: recipientError } = await supabase
      .from('tromail_recipients')
      .insert(recipients)

    if (recipientError) throw recipientError

    // Send notifications
    for (const userId of params.recipient_user_ids) {
      await notifyTromailReceived(userId, params.subject, params.is_important || false)
    }

    return { success: true, message_id: message.id }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to send Tromail message' }
  }
}

// Notify user of received Tromail
export const notifyTromailReceived = async (
  userId: string,
  subject: string,
  isImportant: boolean
): Promise<void> => {
  const prefix = isImportant ? 'Important Tromail received' : 'New Tromail'
  await createNotification(
    userId,
    'new_private_message',
    isImportant ? '📧 Important Tromail Received' : '📧 New Tromail',
    `${prefix}: ${subject.substring(0, 50)}${subject.length > 50 ? '...' : ''}`,
    { sender_username: 'Tromail System', action_url: '/tromail' }
  )
}

// Notify about team meeting scheduled via Tromail
export const notifyTeamMeetingScheduled = async (
  userIds: string[],
  meetingTitle: string,
  meetingId: string,
  scheduledTime: string
): Promise<void> => {
  for (const userId of userIds) {
    await createNotification(
      userId,
      'team_meeting_scheduled',
      '📅 Team Meeting Scheduled',
      `${meetingTitle} scheduled for ${new Date(scheduledTime).toLocaleString()}`,
      { meeting_id: meetingId, meeting_title: meetingTitle, action_url: `/meeting/${meetingId}` }
    )
  }
}

// Get inbox messages for a user
export const getTromailInbox = async (userId: string): Promise<TromailRecipient[]> => {
  const { data, error } = await supabase
    .from('tromail_recipients')
    .select(`
      id,
      message_id,
      recipient_user_id,
      recipient_role,
      recipient_tromail_address,
      read_at,
      archived_at,
      deleted_at,
      is_starred,
      created_at,
      tromail_messages!inner(
        id,
        sender_user_id,
        sender_role,
        sender_tromail_address,
        subject,
        body,
        is_admin_email,
        is_important,
        related_meeting_id,
        created_at,
        updated_at
      )
    `)
    .eq('recipient_user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any
}

// Get sent messages for a user
export const getTromailSent = async (userId: string): Promise<TromailMessage[]> => {
  const { data, error } = await supabase
    .from('tromail_messages')
    .select('*')
    .eq('sender_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as TromailMessage[]
}

// Get important messages for a user
export const getTromailImportant = async (userId: string): Promise<TromailRecipient[]> => {
  const { data, error } = await supabase
    .from('tromail_recipients')
    .select(`
      id,
      message_id,
      recipient_user_id,
      recipient_role,
      recipient_tromail_address,
      read_at,
      archived_at,
      deleted_at,
      is_starred,
      created_at,
      tromail_messages!inner(
        id,
        sender_user_id,
        sender_role,
        sender_tromail_address,
        subject,
        body,
        is_admin_email,
        is_important,
        related_meeting_id,
        created_at,
        updated_at
      )
    `)
    .eq('recipient_user_id', userId)
    .or('is_starred.eq.true,tromail_messages.is_important.eq.true')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any
}

// Get admin emails for a user
export const getTromailAdminEmails = async (userId: string): Promise<TromailRecipient[]> => {
  const { data, error } = await supabase
    .from('tromail_recipients')
    .select(`
      id,
      message_id,
      recipient_user_id,
      recipient_role,
      recipient_tromail_address,
      read_at,
      archived_at,
      deleted_at,
      is_starred,
      created_at,
      tromail_messages!inner(
        id,
        sender_user_id,
        sender_role,
        sender_tromail_address,
        subject,
        body,
        is_admin_email,
        is_important,
        related_meeting_id,
        created_at,
        updated_at
      )
    `)
    .eq('recipient_user_id', userId)
    .eq('tromail_messages.is_admin_email', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as any
}

// Get role directory (all Tromail users)
export const getTromailRoleDirectory = async (): Promise<TromailAccount[]> => {
  const { data, error } = await supabase
    .from('tromail_accounts')
    .select('*')
    .eq('is_active', true)
    .order('role', { ascending: true })

  if (error) throw error
  return data as TromailAccount[]
}

// Create Tromail calendar event
export const createTromailCalendarEvent = async (params: {
  created_by_user_id: string
  created_by_role: string
  title: string
  description?: string
  event_type?: string
  starts_at: string
  ends_at?: string
  meeting_id?: string
  recipient_user_ids: string[]
  recipient_roles: string[]
}): Promise<{ success: boolean; event_id?: string; error?: string }> => {
  try {
    // Create the event
    const { data: event, error: eventError } = await supabase
      .from('tromail_calendar_events')
      .insert({
        created_by_user_id: params.created_by_user_id,
        created_by_role: params.created_by_role,
        title: params.title,
        description: params.description || null,
        event_type: params.event_type || 'meeting',
        starts_at: params.starts_at,
        ends_at: params.ends_at || null,
        meeting_id: params.meeting_id || null,
        status: 'scheduled',
      })
      .select()
      .single()

    if (eventError) throw eventError

    // Create recipients
    const recipients = params.recipient_user_ids.map((userId, index) => ({
      calendar_event_id: event.id,
      recipient_user_id: userId,
      recipient_role: params.recipient_roles[index] || params.created_by_role,
    }))

    const { error: recipientError } = await supabase
      .from('tromail_calendar_event_recipients')
      .insert(recipients)

    if (recipientError) throw recipientError

    return { success: true, event_id: event.id }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create calendar event' }
  }
}

// Mark message as read
export const markTromailRead = async (recipientId: string): Promise<void> => {
  await supabase
    .from('tromail_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('id', recipientId)
}

// Mark message as important/starred
export const markTromailImportant = async (recipientId: string, isStarred: boolean): Promise<void> => {
  await supabase
    .from('tromail_recipients')
    .update({ is_starred: isStarred })
    .eq('id', recipientId)
}

// Archive message
export const archiveTromailMessage = async (recipientId: string): Promise<void> => {
  await supabase
    .from('tromail_recipients')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', recipientId)
}

// Delete message
export const deleteTromailMessage = async (recipientId: string): Promise<void> => {
  await supabase
    .from('tromail_recipients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', recipientId)
}