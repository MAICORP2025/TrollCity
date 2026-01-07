import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", 
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS" 
}; 

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const LOCAL_FALLBACK_SCENARIOS = [
  {
    scenario_type: 'Harassment',
    description: 'User targeting another viewer with personal insults',
    chat_messages: [
      { username: 'Bully', message: 'You are so stupid, uninstall life', timestamp: new Date().toISOString() },
      { username: 'Viewer1', message: 'Please stop', timestamp: new Date().toISOString() }
    ],
    correct_action: 'ban',
    points_awarded: 30,
    difficulty_level: 1
  },
  {
    scenario_type: 'Spam',
    description: 'User repeating same message rapidly',
    chat_messages: [
      { username: 'Spammer', message: 'FOLLOW ME', timestamp: new Date().toISOString() },
      { username: 'Spammer', message: 'FOLLOW ME', timestamp: new Date().toISOString() },
      { username: 'Spammer', message: 'FOLLOW ME', timestamp: new Date().toISOString() }
    ],
    correct_action: 'mute',
    points_awarded: 20,
    difficulty_level: 1
  },
  {
    scenario_type: 'Scam Attempt',
    description: 'User posting suspicious links claiming free coins',
    chat_messages: [
      { username: 'Scammer99', message: 'Get 1000 free coins here! bit.ly/scam', timestamp: new Date().toISOString() },
      { username: 'Viewer1', message: 'Is this real?', timestamp: new Date().toISOString() }
    ],
    correct_action: 'ban',
    points_awarded: 50,
    difficulty_level: 2
  },
  {
    scenario_type: 'Hate Speech',
    description: 'User using racial slurs in chat',
    chat_messages: [
      { username: 'Troll123', message: 'I hate [slur] people', timestamp: new Date().toISOString() },
      { username: 'Viewer2', message: 'Mods??', timestamp: new Date().toISOString() }
    ],
    correct_action: 'ban',
    points_awarded: 50,
    difficulty_level: 3
  },
  {
    scenario_type: 'Self Harm',
    description: 'User threatening self-harm in chat',
    chat_messages: [
      { username: 'SadUser', message: 'I am going to end it all tonight', timestamp: new Date().toISOString() },
      { username: 'Viewer3', message: 'Don\'t say that!', timestamp: new Date().toISOString() }
    ],
    correct_action: 'escalate',
    points_awarded: 40,
    difficulty_level: 3
  },
  {
    scenario_type: 'Inappropriate Content',
    description: 'User posting explicit ASCII art',
    chat_messages: [
      { username: 'ArtBot', message: '8===D', timestamp: new Date().toISOString() },
      { username: 'Viewer4', message: 'Gross', timestamp: new Date().toISOString() }
    ],
    correct_action: 'timeout',
    points_awarded: 15,
    difficulty_level: 1
  },
  {
    scenario_type: 'Subtle Harassment',
    description: 'User making passive-aggressive comments about streamer appearance',
    chat_messages: [
      { username: 'Troll42', message: 'You look tired today', timestamp: new Date().toISOString() },
      { username: 'Troll42', message: 'Maybe you should sleep instead of streaming', timestamp: new Date().toISOString() },
      { username: 'Troll42', message: 'Just looking out for you lol', timestamp: new Date().toISOString() }
    ],
    correct_action: 'warn',
    points_awarded: 35,
    difficulty_level: 4
  },
  {
    scenario_type: 'Doxxing Attempt',
    description: 'User sharing what looks like personal address info',
    chat_messages: [
      { username: 'Stalker', message: 'Hey I know you live at 123 Maple Dr', timestamp: new Date().toISOString() },
      { username: 'Stalker', message: 'See you soon', timestamp: new Date().toISOString() }
    ],
    correct_action: 'ban',
    points_awarded: 100,
    difficulty_level: 5
  },
  {
    scenario_type: 'Political Argument',
    description: 'Users arguing about politics but not breaking rules yet',
    chat_messages: [
      { username: 'LeftWing', message: 'Policy X is the best', timestamp: new Date().toISOString() },
      { username: 'RightWing', message: 'No, Policy Y is better', timestamp: new Date().toISOString() },
      { username: 'LeftWing', message: 'You clearly do not understand economics', timestamp: new Date().toISOString() }
    ],
    correct_action: 'ignore',
    points_awarded: 25,
    difficulty_level: 4
  },
  {
    scenario_type: 'False Report Bait',
    description: 'User pretending to be underage to bait a ban',
    chat_messages: [
      { username: 'NewUser', message: 'I am 12 years old', timestamp: new Date().toISOString() },
      { username: 'NewUser', message: 'Is this game fun?', timestamp: new Date().toISOString() },
      { username: 'NewUser', message: 'Jk I am 25', timestamp: new Date().toISOString() }
    ],
    correct_action: 'warn',
    points_awarded: 45,
    difficulty_level: 3
  },
  {
    scenario_type: 'Borderline Spam',
    description: 'User posting excitement caps but not quite spam',
    chat_messages: [
      { username: 'HypeMan', message: 'LETS GOOOOOOO', timestamp: new Date().toISOString() },
      { username: 'HypeMan', message: 'THIS IS AWESOME', timestamp: new Date().toISOString() }
    ],
    correct_action: 'ignore',
    points_awarded: 10,
    difficulty_level: 2
  },
  {
    scenario_type: 'Solicitation',
    description: 'User trying to sell services in chat',
    chat_messages: [
      { username: 'Artist', message: 'I do commissions! Check my bio', timestamp: new Date().toISOString() },
      { username: 'Artist', message: 'Cheap prices for emotes', timestamp: new Date().toISOString() }
    ],
    correct_action: 'warn',
    points_awarded: 20,
    difficulty_level: 2
  },
  {
    scenario_type: 'Ban Evasion',
    description: 'User claiming to be a banned user',
    chat_messages: [
      { username: 'User_v2', message: 'They banned my main account lol', timestamp: new Date().toISOString() },
      { username: 'User_v2', message: 'Can\'t stop me', timestamp: new Date().toISOString() }
    ],
    correct_action: 'ban',
    points_awarded: 60,
    difficulty_level: 4
  },
  {
    scenario_type: 'Encouraging Rule Breaks',
    description: 'User telling others to break rules',
    chat_messages: [
      { username: 'ChaosMaker', message: 'Everyone spam "F" in chat now!', timestamp: new Date().toISOString() },
      { username: 'ChaosMaker', message: 'Do it do it', timestamp: new Date().toISOString() }
    ],
    correct_action: 'mute',
    points_awarded: 30,
    difficulty_level: 3
  }
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET") {
      return new Response("Method not allowed", { 
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let data = null;

    try {
      // Try to fetch existing scenario from DB
      const { count, error: countError } = await supabase
        .from("training_scenarios")
        .select("*", { count: "exact", head: true });

      if (!countError && count && count > 0) {
        const randomOffset = Math.floor(Math.random() * count);
        const { data: randomScenario, error: fetchError } = await supabase
          .from("training_scenarios")
          .select("*")
          .range(randomOffset, randomOffset)
          .maybeSingle();
          
        if (!fetchError && randomScenario) {
          data = randomScenario;
        }
      }
    } catch (dbError) {
      console.error("Database fetch error:", dbError);
    }

    // If no data found in DB, use a local fallback
    if (!data) {
      console.log("No scenario in DB, returning random fallback");
      data = LOCAL_FALLBACK_SCENARIOS[Math.floor(Math.random() * LOCAL_FALLBACK_SCENARIOS.length)];
      
      // Optionally insert this fallback into DB to populate it for next time
      // This prevents the DB from staying empty forever
      try {
        await supabase.from("training_scenarios").insert(data);
      } catch (insertError) {
        console.error("Failed to populate DB with fallback:", insertError);
      }
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Error in get-training-scenario:", err);
    const fallback = LOCAL_FALLBACK_SCENARIOS[0];
    return new Response(JSON.stringify(fallback), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }); 
  } 
});
