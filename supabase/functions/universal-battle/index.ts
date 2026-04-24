import { serve } from "https://deno.land/x/http_server.ts@0.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BATTLE_DURATION_MS = 3 * 60 * 1000; // 3 minutes

type BattleFormat = "1v1" | "2v2" | "3v3" | "4v4" | "5v5";

function getRequiredPlayers(format: BattleFormat): number {
  const [a, b] = format.split("v");
  return parseInt(a) + parseInt(b);
}

function getTeamSize(format: BattleFormat): number {
  return parseInt(format.split("v")[0]);
}

async function setupBattle(
  streamId: string,
  format: BattleFormat
): Promise<void> {
  await supabase
    .from("streams")
    .update({
      battle_mode: "universal",
      battle_format: format,
      battle_status: "waiting",
      side_a_score: 0,
      side_b_score: 0,
      team_a_members: [],
      team_b_members: [],
    })
    .eq("id", streamId);
}

async function assignTeams(streamId: string, format: BattleFormat): Promise<void> {
  // Get all seated users in order
  const { data: seats } = await supabase
    .from("stream_seats")
    .select("user_id, seat_index")
    .eq("stream_id", streamId)
    .eq("status", "occupied")
    .order("seat_index");

  if (!seats) return;

  const teamSize = getTeamSize(format);
  const teamA: string[] = [];
  const teamB: string[] = [];

  // First teamSize seats go to Team A, rest to Team B
  for (let i = 0; i < seats.length; i++) {
    if (i < teamSize) {
      teamA.push(seats[i].user_id);
    } else {
      teamB.push(seats[i].user_id);
    }
  }

  await supabase
    .from("streams")
    .update({
      team_a_members: teamA,
      team_b_members: teamB,
      battle_status: "ready",
    })
    .eq("id", streamId);
}

async function startBattle(streamId: string): Promise<void> {
  const startTime = new Date().toISOString();
  const endTime = new Date(Date.now() + BATTLE_DURATION_MS).toISOString();

  await supabase
    .from("streams")
    .update({
      battle_status: "active",
      battle_start_time: startTime,
      battle_end_time: endTime,
    })
    .eq("id", streamId);
}

async function endBattle(streamId: string): Promise<{ winnerSide: string; scoreA: number; scoreB: number }> {
  const { data: stream } = await supabase
    .from("streams")
    .select("side_a_score, side_b_score")
    .eq("id", streamId)
    .single();

  if (!stream) {
    throw new Error("Stream not found");
  }

  const winnerSide = stream.side_a_score > stream.side_b_score ? "A" : "B";

  await supabase
    .from("streams")
    .update({
      battle_status: "ended",
      winner_side: winnerSide,
    })
    .eq("id", streamId);

  return {
    winnerSide,
    scoreA: stream.side_a_score,
    scoreB: stream.side_b_score,
  };
}

async function addScore(streamId: string, side: "A" | "B", amount: number): Promise<void> {
  const column = side === "A" ? "side_a_score" : "side_b_score";
  
  await supabase.rpc("increment_battle_score", {
  p_stream_id: streamId,
  p_side: side,
  p_amount: amount,
  });
}

async function resetBattle(streamId: string): Promise<void> {
  await supabase
    .from("streams")
    .update({
      battle_mode: "none",
      battle_format: null,
      battle_status: "waiting",
      side_a_score: 0,
      side_b_score: 0,
      team_a_members: [],
      team_b_members: [],
      battle_start_time: null,
      battle_end_time: null,
      winner_side: null,
    })
    .eq("id", streamId);
}

serve(async (req) => {
  const { action, streamId, format, side, amount } = await req.json();

  try {
    switch (action) {
      case "setup":
        await setupBattle(streamId, format);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

      case "assign_teams":
        await assignTeams(streamId, format);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

      case "start":
        await startBattle(streamId);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

      case "end":
        const result = await endBattle(streamId);
        return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });

      case "add_score":
        await addScore(streamId, side, amount);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

      case "reset":
        await resetBattle(streamId);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});