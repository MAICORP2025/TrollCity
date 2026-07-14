import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { videoId } = await req.json()
    if (!videoId) {
      return new Response(JSON.stringify({ error: "videoId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: video, error } = await supabase
      .from("how_to_videos")
      .select("storage_path, thumbnail_path, is_published")
      .eq("id", videoId)
      .maybeSingle()

    if (error || !video) {
      return new Response(JSON.stringify({ error: "Video not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (!video.is_published) {
      return new Response(JSON.stringify({ error: "Video not published" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // How-To videos may be stored via the Treelz upload path, in which case
    // storage_path/thumbnail_path are already full public URLs. Fall back to a
    // signed URL from the how-to-videos bucket for legacy entries.
    const isUrl = (s: string | null) =>
      typeof s === "string" && /^(https?:|data:)/.test(s)

    const url = isUrl(video.storage_path)
      ? video.storage_path
      : (supabase.storage
          .from("how-to-videos")
          .createSignedUrl(video.storage_path, 3600).data?.signedUrl ?? null)

    const thumbnailUrl = video.thumbnail_path
      ? isUrl(video.thumbnail_path)
        ? video.thumbnail_path
        : (supabase.storage
            .from("how-to-videos")
            .createSignedUrl(video.thumbnail_path, 3600).data?.signedUrl ?? null)
      : null

    return new Response(
      JSON.stringify({
        url,
        thumbnailUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
