import { AccessToken, TrackSource } from 'livekit-server-sdk'
import { authorizeUser, AuthorizedProfile } from './_shared/auth'
import { LIVEKIT_URL } from './livekitconfig'

type TokenRequest = {
  room?: string
  roomName?: string
  identity?: string
  name?: string
  role?: string
  allowPublish?: boolean | string | number
  level?: number | string
}

function parseAllowPublish(v: any): boolean {
  return v === true || v === 'true' || v === 1 || v === '1'
}

const API_KEY = process.env.LIVEKIT_API_KEY
const API_SECRET = process.env.LIVEKIT_API_SECRET

if (!API_KEY || !API_SECRET) {
  console.warn('[livekit-token] LIVEKIT env vars are not set; token issuance will fail until configured')
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Authenticate + load profile
  let profile: AuthorizedProfile
  try {
    profile = await authorizeUser(req)
  } catch (err: any) {
    const msg = err?.message || 'Unauthorized'
    return res.status(401).json({ error: msg })
  }

  const payload: TokenRequest = req.body || {}
  const room = String(payload.room || payload.roomName || '').trim()
  let identity = payload.identity
  const name = payload.name || profile.username || profile.id

  if (!room) return res.status(400).json({ error: 'Missing room' })

  if (!identity || identity === 'null') identity = profile.id

  // Determine publish permissions
  const explicitAllow = parseAllowPublish(payload.allowPublish)
  const roleParam = String(payload.role || profile.role || '').toLowerCase()
  let canPublish = explicitAllow || roleParam === 'broadcaster' || roleParam === 'admin'
  if (profile?.is_broadcaster || profile?.is_admin) canPublish = true

  const metadata = {
    user_id: profile.id,
    username: profile.username,
    role: profile.role,
    avatar_url: profile.avatar_url ?? null,
    level: Number(payload.level ?? 1),
  }

  try {
    if (!API_KEY || !API_SECRET) {
      console.error('[livekit-token] missing LIVEKIT env vars')
      return res.status(500).json({ error: 'LiveKit not configured' })
    }

    const token = new AccessToken(API_KEY, API_SECRET, {
      identity: String(identity),
      name: String(name),
      ttl: 60 * 60,
      metadata: JSON.stringify(metadata),
    })

    token.addGrant({
      room: room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: !!canPublish,
      canPublishData: !!canPublish,
      canUpdateOwnMetadata: true,
      canPublishSources: canPublish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
    })

    const jwt = await token.toJwt()

    return res.status(200).json({
      token: jwt,
      livekitUrl: LIVEKIT_URL ?? null,
      room,
      identity: String(identity),
      allowPublish: !!canPublish,
    })
  } catch (err: any) {
    console.error('[livekit-token] issuance failed', err)
    return res.status(500).json({ error: err?.message || 'Failed to issue LiveKit token' })
  }
}
