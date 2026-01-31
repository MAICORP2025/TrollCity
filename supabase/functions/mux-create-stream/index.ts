import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders })

  try {
    const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID")!
    const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET")!

    const response = await fetch("https://api.mux.com/video/v1/live-streams", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        playback_policy: ["public"],
        new_asset_settings: { playback_policy: ["public"] },
        low_latency: true,
        advanced_audio: {
          codec: "opus",
          bitrate: 64000,
        },
        advanced_video: {
          codec: "h264",
          bitrate: 2500000,
        },
      }),
    })

    const json = await response.json()
    const data = json.data
    const result = {
      stream_key: data.stream_key,
      playback_ids: data.playback_ids.map((p: any) => p.id),
      id: data.id,
    }
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