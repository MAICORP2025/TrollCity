import type { SupabaseClient } from '@supabase/supabase-js'

export interface TransactionProfile {
  id: string
  username?: string | null
  display_name?: string | null
}

export interface TransactionStream {
  id: string
  title?: string | null
  category?: string | null
  user_id?: string | null
  broadcaster_id?: string | null
}

export interface TransactionContextMaps {
  profiles: Map<string, TransactionProfile>
  streams: Map<string, TransactionStream>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function addUuid(set: Set<string>, value: unknown) {
  if (typeof value === 'string' && UUID_PATTERN.test(value)) {
    set.add(value)
  }
}

function getMetadata(metadata: any, key: string) {
  return metadata?.[key]
}

export function getTransactionStreamId(transaction: any) {
  return transaction?.stream_id || getMetadata(transaction?.metadata, 'stream_id') || getMetadata(transaction?.metadata, 'streamId') || null
}

function getSenderId(transaction: any) {
  return transaction?.from_user_id || getMetadata(transaction?.metadata, 'sender_id') || getMetadata(transaction?.metadata, 'from_user_id') || null
}

function getRecipientId(transaction: any) {
  return transaction?.to_user_id || getMetadata(transaction?.metadata, 'recipient_id') || getMetadata(transaction?.metadata, 'recipient') || getMetadata(transaction?.metadata, 'to_user_id') || null
}

export function collectTransactionContextIds(transactions: any[]) {
  const profileIds = new Set<string>()
  const streamIds = new Set<string>()

  transactions.forEach((transaction) => {
    addUuid(profileIds, transaction?.user_id)
    addUuid(profileIds, transaction?.from_user_id)
    addUuid(profileIds, transaction?.to_user_id)
    addUuid(profileIds, getMetadata(transaction?.metadata, 'sender_id'))
    addUuid(profileIds, getMetadata(transaction?.metadata, 'from_user_id'))
    addUuid(profileIds, getMetadata(transaction?.metadata, 'recipient_id'))
    addUuid(profileIds, getMetadata(transaction?.metadata, 'recipient'))
    addUuid(profileIds, getMetadata(transaction?.metadata, 'to_user_id'))

    addUuid(streamIds, transaction?.stream_id)
    addUuid(streamIds, getMetadata(transaction?.metadata, 'stream_id'))
    addUuid(streamIds, getMetadata(transaction?.metadata, 'streamId'))
  })

  return { profileIds, streamIds }
}

export async function loadTransactionContext(
  client: SupabaseClient,
  transactions: any[],
): Promise<TransactionContextMaps> {
  const { profileIds, streamIds } = collectTransactionContextIds(transactions)

  const profilesPromise = profileIds.size > 0
    ? client.from('user_profiles').select('id, username, display_name').in('id', Array.from(profileIds))
    : Promise.resolve({ data: [] as TransactionProfile[], error: null })

  const streamsPromise = streamIds.size > 0
    ? client.from('streams').select('id, title, category, user_id, broadcaster_id').in('id', Array.from(streamIds))
    : Promise.resolve({ data: [] as TransactionStream[], error: null })

  const [profilesResult, streamsResult] = await Promise.all([profilesPromise, streamsPromise])

  if (profilesResult.error) {
    console.warn('Failed to load transaction profile context:', profilesResult.error)
  }

  if (streamsResult.error) {
    console.warn('Failed to load transaction stream context:', streamsResult.error)
  }

  const profileMap = new Map<string, TransactionProfile>()
  const streamMap = new Map<string, TransactionStream>()

  ;(profilesResult.data || []).forEach((profile) => profileMap.set(profile.id, profile))
  ;(streamsResult.data || []).forEach((stream) => streamMap.set(stream.id, stream))

  return {
    profiles: profileMap,
    streams: streamMap,
  }
}

export function enrichTransactionWithProfile(transaction: any, profiles: Map<string, TransactionProfile>, streams: Map<string, TransactionStream>) {
  const metadata = transaction?.metadata || {}
  const streamId = getTransactionStreamId(transaction)
  const stream = streamId ? streams.get(streamId) : undefined
  const broadcasterId = stream?.broadcaster_id || stream?.user_id
  const broadcaster = broadcasterId ? profiles.get(broadcasterId) : undefined

  return {
    ...transaction,
    username: getProfileName(profiles.get(transaction?.user_id), transaction?.from_user_name || transaction?.to_user_name),
    from_username: getProfileName(profiles.get(getSenderId(transaction)), metadata.sender_name || metadata.from_user_name || transaction?.from_user_name),
    to_username: getProfileName(profiles.get(getRecipientId(transaction)), metadata.recipient_name || metadata.to_user_name || transaction?.to_user_name),
    stream_id: streamId,
    stream_title: stream?.title || null,
    stream_category: stream?.category || null,
    stream_broadcaster_username: getProfileName(broadcaster, null),
    is_hytro_gaming: isHytroGamingTransaction(transaction, stream),
  }
}

export function getTransactionUserLabel(transaction: any, profiles: Map<string, TransactionProfile>) {
  const metadata = transaction?.metadata || {}
  const senderId = getSenderId(transaction)
  const recipientId = getRecipientId(transaction)
  const senderName = getProfileName(profiles.get(senderId), metadata.sender_name || metadata.from_user_name || transaction?.from_user_name)
  const recipientName = getProfileName(profiles.get(recipientId), metadata.recipient_name || metadata.to_user_name || transaction?.to_user_name)
  const accountName = getProfileName(profiles.get(transaction?.user_id), transaction?.from_user_name || transaction?.to_user_name)

  if (senderId && recipientId) {
    return `From @${senderName} to @${recipientName}`
  }

  if (senderId) {
    return `From @${senderName}`
  }

  if (recipientId) {
    return `To @${recipientName}`
  }

  return `Account @${accountName}`
}

export function getTransactionAccountLabel(transaction: any, profiles: Map<string, TransactionProfile>) {
  const accountName = getProfileName(profiles.get(transaction?.user_id), transaction?.from_user_name || transaction?.to_user_name)
  return `Account @${accountName}`
}

export function getTransactionStreamLabel(transaction: any, profiles: Map<string, TransactionProfile>, streams: Map<string, TransactionStream>) {
  const streamId = getTransactionStreamId(transaction)
  const stream = streamId ? streams.get(streamId) : undefined
  if (!stream) return null

  const broadcasterId = stream.broadcaster_id || stream.user_id
  const broadcasterName = getProfileName(profiles.get(broadcasterId), null)
  const title = stream.title || 'Untitled stream'
  const platform = isHytroGamingTransaction(transaction, stream) ? 'HytroGaming Stream' : 'Broadcast Stream'

  if (broadcasterName) {
    return `${platform}: ${title} by @${broadcasterName}`
  }

  return `${platform}: ${title}`
}

export function isHytroGamingTransaction(transaction: any, stream?: TransactionStream | null) {
  const source = `${transaction?.metadata?.source || transaction?.source || ''}`.toLowerCase()
  const category = `${stream?.category || ''}`.toLowerCase()

  return category === 'gaming' || source.includes('hytro') || source.includes('gaming') || source.includes('tip')
}

function getProfileName(profile: TransactionProfile | undefined, fallback: string | null) {
  if (!profile && !fallback) return ''
  return profile?.username || profile?.display_name || fallback || 'Unknown User'
}
