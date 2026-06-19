/**
 * Stop Room Recording — LiveKit Egress
 *
 * Stops a running room composite recording.
 *
 * Request body:
 *   recording_id — the egress recording ID from start-room-recording
 *   stream_id — the stream's UUID
 *
 * Response:
 *   success — true if stopped successfully
 *   recording_id — the egress recording ID that was stopped
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
    const { recording_id, stream_id } = await req.json()

    if (!recording_id) {
      return new Response(JSON.stringify({ error: "recording_id is required" }), {
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

    const livekitUrl = LIVEKIT_URL.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://")

    console.log(`[stop-room-recording] Stopping recording: ${recording_id}`)

    const egressClient = new EgressClient(livekitUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    await egressClient.stopEgress(recording_id)

    console.log(`[stop-room-recording] Recording stopped: ${recording_id}`)

    return new Response(JSON.stringify({
      success: true,
      recording_id: recording_id,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })

  } catch (err: any) {
    console.error("[stop-room-recording] Error:", err)
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
