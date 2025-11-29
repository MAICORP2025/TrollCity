import { AccessToken } from 'npm:livekit-server-sdk'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

serve(async (req) => {
  const url = new URL(req.url)
  const room = url.searchParams.get("room") || "default-room"
  const identity = url.searchParams.get("identity") || "guest"

  const apiKey = Deno.env.get("LIVEKIT_API_KEY")
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")

  if (!apiKey || !apiSecret) {
    return new Response(
      JSON.stringify({ error: "🚨 Missing LiveKit API credentials in Supabase Secrets" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  const token = new AccessToken(apiKey, apiSecret, { identity })
  token.addGrant({ roomJoin: true, room })

  return new Response(
    JSON.stringify({ token: token.toJwt(), room }),
    { headers: { "Content-Type": "application/json" } }
  )
})
