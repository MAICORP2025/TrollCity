import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", // you can replace with localhost only later 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", 
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS" 
}; 

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // ✅ Handle preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: authUser, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const officerId = authUser.user.id;
    const { scenarioId, actionTaken, responseTime } = await req.json();

    if (!scenarioId || !actionTaken) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get scenario
    const { data: scenario, error: scenarioError } = await supabase
      .from("training_scenarios")
      .select("*")
      .eq("id", scenarioId)
      .single();

    if (scenarioError || !scenario) {
      return new Response(JSON.stringify({ error: "Scenario not found" }), { 
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const isCorrect = scenario.correct_action === actionTaken;
    const pointsEarned = isCorrect ? scenario.points_awarded : 0;

    // Insert training session record
    const { error: insertError } = await supabase
      .from("officer_training_sessions")
      .insert({
        officer_id: officerId,
        scenario_id: scenarioId,
        action_taken: actionTaken,
        is_correct: isCorrect,
        response_time_seconds: responseTime,
        points_earned: pointsEarned
      });

    if (insertError) {
      console.error("Error inserting training session:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save response" }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check if officer qualifies for promotion (≥80% accuracy and 150+ points)
    const { data: sessions } = await supabase
      .from("officer_training_sessions")
      .select("is_correct, points_earned")
      .eq("officer_id", officerId);

    let promoted = false;
    if (sessions && sessions.length > 0) {
      const totalPoints = sessions.reduce((sum, s) => sum + (s.points_earned || 0), 0);
      const correctCount = sessions.filter(s => s.is_correct).length;
      const accuracy = (correctCount / sessions.length) * 100;

      if (accuracy >= 80 && totalPoints >= 150) {
        // Promote to officer
        const { error: promoteError } = await supabase
          .from("user_profiles")
          .update({ 
            role: 'troll_officer',
            is_troll_officer: true 
          })
          .eq("id", officerId);
          
        if (!promoteError) {
          promoted = true;
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      isCorrect, 
      pointsEarned,
      promoted
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }); 
  } 
});
