/**
 * Start Room Recording — LiveKit Egress
 *
 * Starts a composite room recording via LiveKit's Egress API.
 * Records ALL participants' audio + video into a single MP4 file.
 *
 * Environment variables needed:
 *   LIVEKIT_URL — your LiveKit server URL (e.g. wss://xxx.livekit.cloud)
 *   LIVEKIT_API_KEY — API key
 *   LIVEKIT_API_SECRET — API secret
 *
 * Request body:
 *   stream_id — the stream's UUID (used as the LiveKit room name)
 *
 * Response:
 *   recording_id — the egress recording ID
 *   room_name — the LiveKit room name being recorded
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { EgressClient } from "npm:livekit-server-sdk@2"

const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL") ?? ""
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY") ?? ""
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET") ?? ""

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, x-client-info, apikey, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  try {
    const { stream_id } = await req.json()

    if (!stream_id) {
      return new Response(JSON.stringify({ error: "stream_id is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return new Response(JSON.stringify({ error: "LiveKit not configured" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const roomName = stream_id
    const livekitUrl = LIVEKIT_URL.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://")

    console.log(`[start-room-recording] Starting recording for room: ${roomName}`)

    const egressClient = new EgressClient(livekitUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      { layout: "grid", audioOnly: false, videoOnly: false }
    )

    const egressId = egressInfo.egressId

    if (!egressId) {
      throw new Error("Egress started but no egressId returned")
    }

    console.log(`[start-room-recording] Recording started: ${egressId}`)

    return new Response(JSON.stringify({
      success: true,
      recording_id: egressId,
      room_name: roomName,
      status: "recording",
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })

  } catch (err: any) {
    console.error("[start-room-recording] Error:", err)
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
