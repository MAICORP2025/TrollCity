// Generate LiveKit token
async function generateLiveKitToken(apiKey: string, apiSecret: string, roomName: string, identity: string) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    exp: now + 3600, // 1 hour
    nbf: now,
    sub: identity,
    name: identity,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true
    }
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export default async function handler(req, res) {
  const { channelName, uid } = req.body;

  if (!channelName || !uid) {
    return res.status(400).json({ error: "Missing channelName or uid" });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "LiveKit API key or secret not configured" });
  }

  const token = await generateLiveKitToken(apiKey, apiSecret, channelName, uid);

  res.status(200).json({ token });
}