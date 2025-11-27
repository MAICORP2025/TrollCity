// Node.js compatible JWT token generator for LiveKit
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://trollcity.app');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { identity = require('crypto').randomUUID(), room = "trollcity" } = req.body;

    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
    const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
    const LIVEKIT_URL = process.env.LIVEKIT_URL;

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      return res.status(500).json({ error: "LiveKit configuration missing" });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60; // 1 hour

    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      iss: LIVEKIT_API_KEY,
      sub: identity,
      exp,
      video: {
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      },
    };

    const partialToken = `${Buffer.from(JSON.stringify(header)).toString('base64')}.${Buffer.from(JSON.stringify(payload)).toString('base64')}`;

    const crypto = require('crypto');
    const key = LIVEKIT_API_SECRET;
    const signature = crypto.createHmac('sha256', key).update(partialToken).digest('base64');

    const token = `${partialToken}.${signature}`;

    return res.status(200).json({ token, serverUrl: LIVEKIT_URL });
  } catch (err) {
    console.error("LiveKit Token Error:", err);
    return res.status(500).json({ error: err.message });
  }
}