import { AccessToken } from "livekit-server-sdk";

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

  const at = new AccessToken(apiKey, apiSecret, {
    identity: uid,
    name: uid,
  });

  at.addGrant({
    roomJoin: true,
    room: channelName,
    canPublish: true,
    canSubscribe: true,
  });

  const token = at.toJwt();

  res.status(200).json({ token });
}