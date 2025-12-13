import { serve } from "https://deno.land/std@0.214.0/http/server.ts"
import { AccessToken } from "npm:livekit-server-sdk"

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.maitrollcity.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (request: Request) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { room, identity, role } = await request.json()

    if (!room || !identity) {
      return new Response(
        JSON.stringify({ success: false, error: "Identity is required" }),
        { status: 400, headers: corsHeaders }
      )
    }

    const token = new AccessToken(
      Deno.env.get("LIVEKIT_API_KEY")!,
      Deno.env.get("LIVEKIT_API_SECRET")!,
      { identity }
    )

    token.addGrant({
      room,
      roomJoin: true,
      canPublish: role !== "viewer",
      canSubscribe: true,
    })

    return new Response(
      JSON.stringify({ success: true, token: token.toJwt() }),
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
        success: false,
        error: "Failed to generate token",
        details: String(err),
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
