import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const AGORA_APP_ID = Deno.env.get("AGORA_APP_ID") ?? ""
const AGORA_CUSTOMER_ID = Deno.env.get("AGORA_CUSTOMER_ID") ?? ""
const AGORA_CUSTOMER_SECRET = Deno.env.get("AGORA_CUSTOMER_SECRET") ?? ""
const AGORA_REST_BASE = Deno.env.get("AGORA_REST_BASE") ?? "https://api.agora.io"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, x-client-info, apikey, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function getAgoraAuth(): string {
  const str = `${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`
  try {
    return `Basic ${btoa(str)}`
  } catch {
    return ""
  }
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
    const { recording_id, resource_id, channel_name, podcast_id } = await req.json()

    if (!recording_id || !resource_id || !channel_name) {
      return new Response(JSON.stringify({ error: "recording_id, resource_id, and channel_name are required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    if (!AGORA_APP_ID || !AGORA_CUSTOMER_ID || !AGORA_CUSTOMER_SECRET) {
      return new Response(JSON.stringify({ error: "Agora credentials not configured" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const stopUrl = `${AGORA_REST_BASE}/v1/apps/${AGORA_APP_ID}/cloud_recording/resourceid/${resource_id}/sid/${recording_id}/mode/mix/stop`

    const stopBody = {
      cname: channel_name,
      uid: "0",
      clientRequest: {},
    }

    console.log(`[stop-podcast-recording] Stopping recording: ${recording_id}`)

    const stopRes = await fetch(stopUrl, {
      method: "POST",
      headers: {
        "Authorization": getAgoraAuth(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(stopBody),
    })

    const stopData = await stopRes.json()

    if (!stopRes.ok) {
      console.error(`[stop-podcast-recording] Stop error:`, stopData)
      return new Response(JSON.stringify({
        error: stopData.message || stopData.msg || "Failed to stop recording",
        raw: stopData,
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const fileList = stopData.serverResponse?.fileList || stopData.fileList || []
    const fileUrl = fileList.length > 0 ? (fileList[0].fileName || fileList[0].url) : null

    console.log(`[stop-podcast-recording] Recording stopped. File: ${fileUrl}`)

    return new Response(JSON.stringify({
      success: true,
      file_url: fileUrl,
      recording_id: recording_id,
      file_list: fileList,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })

  } catch (err: any) {
    console.error("[stop-podcast-recording] Error:", err)
    return new Response(JSON.stringify({
      error: err.message || "Internal error",
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
