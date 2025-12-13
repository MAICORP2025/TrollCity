import { serve } from "https://deno.land/std@0.214.0/http/server.ts"
import { AccessToken, TrackSource } from "https://esm.sh/livekit-server-sdk"

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.maitrollcity.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

// Grab secrets
const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")!
const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET")!
const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL")!

serve(async (request: Request) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { room, identity, role } = await request.json()

    if (!room || !identity) {
      return new Response(
        JSON.stringify({ error: "Room and identity are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // POST = broadcaster, GET = viewer
    const isBroadcaster = request.method === "POST"
    const canPublish = isBroadcaster
    const canPublishData = isBroadcaster

    const metadata = {
      user_id: null,
      role: role || (isBroadcaster ? "broadcaster" : "viewer"),
      level: 1,
    }

    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(identity),
      ttl: 60 * 60 * 6, // 6 hours
      metadata: JSON.stringify(metadata),
    })

    token.addGrant({
      room: String(room),
      roomJoin: true,
      canSubscribe: true,
      canPublish,
      canPublishData,
      canUpdateOwnMetadata: true,
      canPublishSources: canPublish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
    })

    const jwt = await token.toJwt()

    return new Response(
      JSON.stringify({ token: jwt, url: LIVEKIT_URL }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Failed to generate token",
        details: String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
