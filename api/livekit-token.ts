// File: /api/livekit-token.ts
// Universal LiveKit token endpoint for ALL Troll City live features

import { AccessToken, TrackSource } from 'livekit-server-sdk'

export default async function handler(req: any, res: any) {
  /* ============================
     METHOD GUARD
  ============================ */
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  /* ============================
     PARAMS
  ============================ */
  const params = req.method === 'POST' ? req.body : req.query

  const room = params.room
  const identity = params.identity
  const user_id = params.user_id
  const role = params.role
  const level = params.level

  /* ============================
     HARD GUARDS
  ============================ */
  if (!room || !identity) {
    return res.status(400).json({
      error: 'Missing required parameters: room or identity',
    })
  }

  /* ============================
     ROLE RESOLUTION
     POST with allowPublish → broadcaster
     GET  → viewer (default)
     POST without allowPublish → viewer
  ============================ */
  const allowPublish = params.allowPublish === true || params.allowPublish === 'true'
  const isBroadcaster = req.method === 'POST' && allowPublish
  const resolvedRole = isBroadcaster ? (role || 'broadcaster') : 'viewer'

  /* ============================
     METADATA
  ============================ */
  const metadata = {
    user_id: user_id ?? null,
    role: resolvedRole,
    level: Number(level ?? 1),
  }

  /* ============================
     ENV VALIDATION
  ============================ */
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitUrl = process.env.LIVEKIT_CLOUD_URL

  if (!apiKey || !apiSecret || !livekitUrl) {
    return res.status(500).json({ error: 'LiveKit not configured' })
  }

  /* ============================
     TOKEN
  ============================ */
  const token = new AccessToken(apiKey, apiSecret, {
    identity: String(identity),
    ttl: 60 * 60 * 6,
    metadata: JSON.stringify(metadata),
  })

  /* ============================
     PUBLISH AUTHORITY
     Only broadcasters can publish
  ============================ */
  const canPublish = isBroadcaster
  const canPublishData = isBroadcaster

  /* ============================
     DEBUG LOG
  ============================ */
  console.log('[LiveKit Token Issued]', {
    method: req.method,
    room,
    identity,
    role: resolvedRole,
    isBroadcaster,
    canPublish,
    allowPublish: params.allowPublish,
    sources: canPublish
      ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
      : [],
  })

  /* ============================
     GRANTS - FIXED BROADCASTER/VIEWER DISTINCTION
     - Broadcasters: can publish video + audio, subscribe to others
     - Viewers: can only subscribe, cannot publish
  ============================ */
  token.addGrant({
    room: String(room),
    roomJoin: true,
    canSubscribe: true,  // Everyone can subscribe/watch
    canPublish,           // Only broadcasters
    canPublishData,       // Only broadcasters
    canUpdateOwnMetadata: true,
    canPublishSources: canPublish
      ? [TrackSource.CAMERA, TrackSource.MICROPHONE]
      : [],
  })

  /* ============================
     RESPONSE
  ============================ */
  return res.status(200).json({
    token: await token.toJwt(),
    livekitUrl,
    serverUrl: livekitUrl,
    url: livekitUrl,
  })
}
