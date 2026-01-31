import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders })

  try {
    const { roomName, streamKey } = await req.json()

    const LIVEKIT_API_KEY = Deno.env.get("LIVEKIT_API_KEY")!
    const LIVEKIT_API_SECRET = Deno.env.get("LIVEKIT_API_SECRET")!
    const LIVEKIT_URL = Deno.env.get("LIVEKIT_URL")!

    // Extract the host from LIVEKIT_URL, assuming it's like ws://host:port or http://host:port
    const url = new URL(LIVEKIT_URL.replace('ws://', 'http://').replace('wss://', 'https://'))
    const livekitHost = url.hostname
    const livekitPort = url.port || '7880'

    const rtmpUrl = `rtmp://live.mux.com/app/${streamKey}`

    const response = await fetch(`http://${livekitHost}:${livekitPort}/rtmp/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(`${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET}`),
      },
      body: JSON.stringify({
        room: roomName,
        url: rtmpUrl
      }),
    })

    const result = await response.json()
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: corsHeaders,
    })
  }
})