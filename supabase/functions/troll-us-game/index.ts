import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface GameState {
  gameId: string;
  streamId: string;
  hostId: string;
  status: string;
  currentRound: number;
}

async function createGame(hostId: string, streamId: string): Promise<GameState> {
  const { data: game, error } = await supabase
    .from("games")
    .insert({
      host_id: hostId,
      stream_id: streamId,
      status: "lobby",
    })
    .select()
    .single();

  if (error) throw error;
  return game;
}

async function joinGame(gameId: string, userId: string, seatIndex: number): Promise<void> {
  const { error } = await supabase.from("game_players").insert({
    game_id: gameId,
    user_id: userId,
    seat_index: seatIndex,
    is_seated: true,
  });

  if (error) throw error;
}

async function startGame(gameId: string): Promise<void> {
  // Get all players
  const { data: players } = await supabase
    .from("game_players")
    .select("*")
    .eq("game_id", gameId)
    .eq("is_seated", true)
    .eq("is_eliminated", false);

  if (!players || players.length === 0) {
    throw new Error("No players to start game");
  }

  // Randomly assign one troll
  const trollIndex = Math.floor(Math.random() * players.length);
  
  // Update all players with roles
  for (let i = 0; i < players.length; i++) {
    await supabase
      .from("game_players")
      .update({
        role: i === trollIndex ? "troll" : "hunter",
      })
      .eq("id", players[i].id);
  }

  // Update game status
  await supabase
    .from("games")
    .update({
      status: "live",
      current_round: 1,
    })
    .eq("id", gameId);

  // Update stream status
  const { data: game } = await supabase
    .from("games")
    .select("stream_id")
    .eq("id", gameId)
    .single();

  if (game) {
    await supabase
      .from("streams")
      .update({
        layout_mode: "game",
      })
      .eq("id", game.stream_id);
  }
}

async function submitVote(gameId: string, voterId: string, targetId: string, round: number): Promise<void> {
  // Check if already voted
  const { data: existing } = await supabase
    .from("game_votes")
    .select("*")
    .eq("game_id", gameId)
    .eq("round", round)
    .eq("voter_id", voterId)
    .single();

  if (existing) {
    await supabase
      .from("game_votes")
      .update({ target_id: targetId })
      .eq("id", existing.id);
  } else {
    await supabase.from("game_votes").insert({
      game_id: gameId,
      round,
      voter_id: voterId,
      target_id: targetId,
    });
  }
}

async function processRound(gameId: string): Promise<string | null> {
  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (!game || game.status !== "live") return null;

  // Get all votes for current round
  const { data: votes } = await supabase
    .from("game_votes")
    .select("target_id")
    .eq("game_id", gameId)
    .eq("round", game.current_round);

  if (!votes || votes.length === 0) return null;

  // Count votes
  const voteCount: Record<string, number> = {};
  for (const vote of votes) {
    voteCount[vote.target_id] = (voteCount[vote.target_id] || 0) + 1;
  }

  // Find target with most votes
  let eliminatedId = "";
  let maxVotes = 0;
  for (const [id, count] of Object.entries(voteCount)) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminatedId = id;
    }
  }

  if (eliminatedId) {
    // Mark player as eliminated
    await supabase
      .from("game_players")
      .update({
        is_eliminated: true,
        is_muted: true,
      })
      .eq("game_id", gameId)
      .eq("user_id", eliminatedId);

    // Get remaining players
    const { data: remaining } = await supabase
      .from("game_players")
      .select("*")
      .eq("game_id", gameId)
      .eq("is_eliminated", false);

    // Check win conditions
    const troll = remaining?.find(p => p.role === "troll");
    
    if (!troll || (remaining?.length || 0) <= 2) {
      // Game ends
      const winnerId = troll ? troll.user_id : remaining?.[0]?.user_id;
      
      await supabase
        .from("games")
        .update({
          status: "ended",
          winner_id: winnerId,
        })
        .eq("id", gameId);

      // Reset stream
      const { data: g } = await supabase
        .from("games")
        .select("stream_id")
        .eq("id", gameId)
        .single();

      if (g) {
        await supabase
          .from("streams")
          .update({
            layout_mode: "grid",
          })
          .eq("id", g.stream_id);
      }

      return winnerId;
    }

    // Next round
    await supabase
      .from("games")
      .update({
        current_round: game.current_round + 1,
      })
      .eq("id", gameId);
  }

  return eliminatedId;
}

async function endGame(gameId: string): Promise<void> {
  await supabase
    .from("games")
    .update({ status: "ended" })
    .eq("id", gameId);

  const { data: game } = await supabase
    .from("games")
    .select("stream_id")
    .eq("id", gameId)
    .single();

  if (game) {
    await supabase
      .from("streams")
      .update({
        layout_mode: "grid",
      })
      .eq("id", game.stream_id);
  }
}

serve(async (req) => {
  const { action, gameId, userId, streamId, seatIndex, targetId, round } = await req.json();

  try {
    switch (action) {
      case "create":
        const game = await createGame(userId, streamId);
        return new Response(JSON.stringify(game), { headers: { "Content-Type": "application/json" } });

      case "join":
        await joinGame(gameId, userId, seatIndex);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

      case "start":
        await startGame(gameId);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

      case "vote":
        await submitVote(gameId, userId, targetId, round);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

      case "process_round":
        const eliminated = await processRound(gameId);
        return new Response(JSON.stringify({ eliminated }), { headers: { "Content-Type": "application/json" } });

      case "end":
        await endGame(gameId);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});