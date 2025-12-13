import { serve } from "https://deno.land/std@0.214.0/http/server.ts"
import { AccessToken } from "npm:livekit-server-sdk"

serve(async (request: Request) => {
  try {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405 }
      )
    }

    const body = await request.json()
    const { room, identity, role = "viewer" } = body

    if (!room || !identity) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing room or identity" }),
        { status: 400 }
      )
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY")
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")

    if (!apiKey || !apiSecret) {
      throw new Error("Missing LiveKit env vars")
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
    })

    token.addGrant({
      room,
      roomJoin: true,
      canPublish: role !== "viewer",
      canSubscribe: true,
    })

    return new Response(
      JSON.stringify({
        success: true,
        token: token.toJwt(),
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to generate token",
        details: err.message,
      }),
      { status: 500 }
    )
  }
})
