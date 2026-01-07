import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { RoomServiceClient } from "npm:livekit-server-sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

console.log("✅ LIVEKIT API FUNCTION STARTED");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Verify User
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // 2. Check Admin/Staff Role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("role, is_admin, is_lead_officer, is_troll_officer")
      .eq("id", user.id)
      .single();

    if (!profile || (!profile.is_admin && !profile.is_lead_officer && !profile.is_troll_officer)) {
      throw new Error("Insufficient permissions");
    }

    // 3. Connect to LiveKit
    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!livekitUrl || !apiKey || !apiSecret) {
      throw new Error("LiveKit configuration missing");
    }

    const svc = new RoomServiceClient(livekitUrl, apiKey, apiSecret);

    // 4. Handle Request
    let action: string | null = null;
    let roomName: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      action = url.searchParams.get("action");
      roomName = url.searchParams.get("room");
    } else {
      const body = await req.json();
      action = body.action;
      roomName = body.room;
    }

    let result;

    if (action === "list_rooms") {
      const rooms = await svc.listRooms();
      result = rooms;
    } else if (action === "get_participants") {
      if (!roomName) throw new Error("Room name required");
      const participants = await svc.listParticipants(roomName);
      result = participants;
    } else {
      throw new Error("Invalid action");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
