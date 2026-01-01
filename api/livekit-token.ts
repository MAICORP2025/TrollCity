export const config = {
  runtime: "nodejs",
};

import { AccessToken } from "livekit-server-sdk";

type TokenRequest = {
  room?: string;
  roomName?: string;
  identity?: string;
  name?: string;
  role?: string;
  allowPublish?: boolean | string | number;
  level?: number | string;
};

function parseAllowPublish(v: any): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const payload: TokenRequest = req.body || {};

    const room = String(payload.room || payload.roomName || "").trim();
    let identity = payload.identity;
    const name = String(payload.name || payload.identity || "Anonymous");

    if (!room) return res.status(400).json({ error: "Missing room" });

    if (!identity || identity === "null") {
      identity = crypto.randomUUID();
    }

    const explicitAllow = parseAllowPublish(payload.allowPublish);
    const roleParam = String(payload.role || "").toLowerCase();

    const canPublish =
      explicitAllow || roleParam === "broadcaster" || roleParam === "admin";

    const API_KEY = process.env.LIVEKIT_API_KEY;
    const API_SECRET = process.env.LIVEKIT_API_SECRET;
    const LIVEKIT_URL = process.env.LIVEKIT_URL;

    if (!API_KEY || !API_SECRET) {
      return res
        .status(500)
        .json({ error: "LiveKit keys missing in env vars" });
    }

    const token = new AccessToken(API_KEY, API_SECRET, {
      identity: String(identity),
      name: String(name),
      ttl: 60 * 60,
      metadata: JSON.stringify({
        identity,
        role: roleParam || "viewer",
        level: Number(payload.level || 1),
      }),
    });

    token.addGrant({
      room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: canPublish,
      canPublishData: canPublish,
    });

    const jwt = token.toJwt();

    return res.status(200).json({
      token: jwt,
      livekitUrl: LIVEKIT_URL || null,
      room,
      identity: String(identity),
      allowPublish: canPublish,
    });
  } catch (err: any) {
    console.error("❌ livekit-token crashed:", err);
    return res.status(500).json({ error: err?.message || "Token function crashed" });
  }
}
