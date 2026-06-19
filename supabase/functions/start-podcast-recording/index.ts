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
    const { podcast_id, channel_name } = await req.json()

    if (!podcast_id || !channel_name) {
      return new Response(JSON.stringify({ error: "podcast_id and channel_name are required" }), {
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

    const recordingUid = String(Math.floor(Math.random() * 4000000000) + 1000000000)

    // Step 1: Acquire a resource ID for this recording
    const acquireUrl = `${AGORA_REST_BASE}/v1/apps/${AGORA_APP_ID}/cloud_recording/acquire`
    const acquireBody = {
      cname: channel_name,
      uid: recordingUid,
      clientRequest: {
        resourceExpiredHour: 48,
      },
    }

    console.log(`[start-podcast-recording] Acquiring resource for channel: ${channel_name}`)

    const acquireRes = await fetch(acquireUrl, {
      method: "POST",
      headers: {
        "Authorization": getAgoraAuth(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(acquireBody),
    })

    const acquireData = await acquireRes.json()

    if (!acquireRes.ok) {
      console.error(`[start-podcast-recording] Acquire error:`, acquireData)
      return new Response(JSON.stringify({
        error: acquireData.message || acquireData.msg || "Failed to acquire recording resource",
        raw: acquireData,
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const resourceId = acquireData.resourceId || acquireData.resource_id
    if (!resourceId) {
      console.error(`[start-podcast-recording] No resourceId in acquire response:`, acquireData)
      return new Response(JSON.stringify({
        error: "No resourceId returned from acquire step",
        raw: acquireData,
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Step 2: Start the cloud recording
    const startUrl = `${AGORA_REST_BASE}/v1/apps/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix/start`
    const startBody = {
      cname: channel_name,
      uid: recordingUid,
      clientRequest: {
        token: "",
        recordingConfig: {
          channelType: 1,
          streamTypes: 2,
          maxIdleTime: 30,
          audioProfile: 1,
        },
        storageConfig: {
          vendor: 0,
          region: 0,
          bucket: "",
          accessKey: "",
          secretKey: "",
          fileNamePrefix: [`podcast_${podcast_id}`],
        },
      },
    }

    console.log(`[start-podcast-recording] Starting recording for channel: ${channel_name}, resource: ${resourceId}`)

    const startRes = await fetch(startUrl, {
      method: "POST",
      headers: {
        "Authorization": getAgoraAuth(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(startBody),
    })

    const startData = await startRes.json()

    if (!startRes.ok) {
      console.error(`[start-podcast-recording] Start error:`, startData)
      return new Response(JSON.stringify({
        error: startData.message || startData.msg || "Failed to start recording",
        raw: startData,
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const recordingId = startData.sid || startData.recording_id

    console.log(`[start-podcast-recording] Recording started: ${recordingId}`)

    return new Response(JSON.stringify({
      success: true,
      recording_id: recordingId,
      resource_id: resourceId,
      channel_name: channel_name,
      status: "recording",
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })

  } catch (err: any) {
    console.error("[start-podcast-recording] Error:", err)
    return new Response(JSON.stringify({
      error: err.message || "Internal error",
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
