import { AccessToken, TrackSource } from 'livekit-server-sdk'
import { authorizeUser, AuthorizedProfile } from './_shared/auth'
import { LIVEKIT_URL } from './livekitconfig'

const API_KEY = process.env.LIVEKIT_API_KEY
const API_SECRET = process.env.LIVEKIT_API_SECRET

if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
  throw new Error('LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set')
}

type TokenRequest = {
  room?: string
  roomName?: string
  participantName?: string
  allowPublish?: boolean | 'true' | 'false' | '1' | '0'
  level?: number | string
}

function normalizeRoom(data: TokenRequest) {
  return String(data.room || data.roomName || '').trim()
}

function normalizeParticipantName(profile: AuthorizedProfile, data: TokenRequest) {
  return String(data.participantName || profile.username || profile.id || '').trim()
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  let profile: AuthorizedProfile
  try {
    profile = await authorizeUser(req)
  } catch (error: any) {
    const message = error?.message || 'Unauthorized'
    return res.status(403).json({ error: message })
  }

  const payload: TokenRequest = req.body || {}
  const roomName = normalizeRoom(payload)
  const participantName = normalizeParticipantName(profile, payload)

  if (!roomName) {
    return res.status(400).json({ error: 'Missing room name' })
  }
  if (!participantName) {
    return res.status(400).json({ error: 'Missing participant name' })
  }

  const publishAllowed =
    payload.allowPublish === true ||
    payload.allowPublish === 'true' ||
    payload.allowPublish === '1'
  const metadata = {
    user_id: profile.id,
    username: profile.username,
    avatar_url: profile.avatar_url ?? null,
    role: profile.role,
    level: Number(payload.level ?? 1),
    participantName,
  }
  
  console.log(`[livekit-token] room=${roomName} user=${profile.id} allowPublish=${publishAllowed}`)

  try {
    const token = new AccessToken(API_KEY!, API_SECRET!, {
      identity: profile.id,
      name: participantName,
      ttl: 60 * 60, // 1 hour
      metadata: JSON.stringify(metadata),
    })

    const grant = {
      room: roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublish: publishAllowed,
      canPublishData: publishAllowed,
      canUpdateOwnMetadata: true,
      canPublishSources: publishAllowed ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
    }

    token.addGrant(grant)

    return res.status(200).json({
      token: await token.toJwt(),
      livekitUrl: LIVEKIT_URL,
      room: roomName,
      identity: profile.id,
      allowPublish: publishAllowed,
    })
  } catch (error: any) {
    console.error('[livekit-token] issuance failed', error)
    return res.status(500).json({ error: 'Failed to issue LiveKit token' })
  }
}
