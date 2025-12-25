import { RequestHandler } from "express";
import {
  supabase,
  getUserById,
} from "../supabaseClient";
import { getUserIdFromSession } from "../sessions";

const getUserFromRequest = async (req: any): Promise<any | null> => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return null;
  const userId = getUserIdFromSession(sessionId);
  if (!userId) return null;
  return await getUserById(userId);
};

export const handleGetCreatorFams: RequestHandler = async (req, res) => {
  try {
    const { creatorId } = req.params;

    const { data: fams, error } = await supabase
      .from("creator_fams")
      .select("*")
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      fams: fams || [],
    });
  } catch (error) {
    console.error("Get creator fams error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get creator fams",
    });
  }
};

export const handleCreateCreatorFam: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const {
      creator_id,
      name,
      description,
      coin_cost_monthly,
      max_members,
      perks_included,
    } = req.body;

    if (!creator_id || !name || !coin_cost_monthly) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const { data: fam, error } = await supabase
      .from("creator_fams")
      .insert([
        {
          creator_id,
          name,
          description,
          coin_cost_monthly,
          max_members,
          perks_included: perks_included || {},
          active: true,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      fam,
    });
  } catch (error) {
    console.error("Create creator fam error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create fam",
    });
  }
};

export const handleUpdateCreatorFam: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { famId } = req.params;
    const { name, description, coin_cost_monthly, max_members, perks_included, active } = req.body;

    const { data: fam, error } = await supabase
      .from("creator_fams")
      .update({
        name,
        description,
        coin_cost_monthly,
        max_members,
        perks_included,
        active,
      })
      .eq("id", famId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      fam,
    });
  } catch (error) {
    console.error("Update creator fam error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update fam",
    });
  }
};

export const handleDeleteCreatorFam: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { famId } = req.params;

    await supabase
      .from("creator_fams")
      .delete()
      .eq("id", famId);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete creator fam error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete fam",
    });
  }
};

export const handleJoinFam: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { famId } = req.body;

    if (!famId) {
      return res.status(400).json({
        success: false,
        error: "Missing famId",
      });
    }

    const { data: fam, error: famError } = await supabase
      .from("creator_fams")
      .select("*")
      .eq("id", famId)
      .single();

    if (famError) throw famError;

    if (!fam.active) {
      return res.status(400).json({
        success: false,
        error: "This fam is no longer active",
      });
    }

    if (fam.max_members && fam.current_members >= fam.max_members) {
      return res.status(400).json({
        success: false,
        error: "This fam is at maximum capacity",
      });
    }

    if (user.coin_balance < fam.coin_cost_monthly) {
      return res.status(400).json({
        success: false,
        error: "Insufficient coins",
      });
    }

    const { data: membership, error: memberError } = await supabase
      .from("fam_members")
      .insert([
        {
          fam_id: famId,
          user_id: user.id,
        },
      ])
      .select()
      .single();

    if (memberError) throw memberError;

    await supabase
      .from("creator_fams")
      .update({
        current_members: fam.current_members + 1,
      })
      .eq("id", famId);

    res.json({
      success: true,
      membership,
    });
  } catch (error) {
    console.error("Join fam error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to join fam",
    });
  }
};

export const handleLeaveFam: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { famId } = req.body;

    if (!famId) {
      return res.status(400).json({
        success: false,
        error: "Missing famId",
      });
    }

    await supabase
      .from("fam_members")
      .delete()
      .eq("fam_id", famId)
      .eq("user_id", user.id);

    const { data: fam, error: famError } = await supabase
      .from("creator_fams")
      .select("*")
      .eq("id", famId)
      .single();

    if (famError && famError.code !== "PGRST116") throw famError;

    if (fam && fam.current_members > 0) {
      await supabase
        .from("creator_fams")
        .update({
          current_members: fam.current_members - 1,
        })
        .eq("id", famId);
    }

    res.json({
      success: true,
    });
  } catch (error) {
    console.error("Leave fam error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to leave fam",
    });
  }
};

export const handleGetFamMembers: RequestHandler = async (req, res) => {
  try {
    const { famId } = req.params;

    const { data: members, error } = await supabase
      .from("fam_members")
      .select(
        `
        id,
        joined_at,
        users!user_id (id, username, display_name, avatar_url)
      `
      )
      .eq("fam_id", famId);

    if (error) throw error;

    res.json({
      success: true,
      members: members || [],
    });
  } catch (error) {
    console.error("Get fam members error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get fam members",
    });
  }
};

export const handleGetUserFams: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { data: memberships, error: membersError } = await supabase
      .from("fam_members")
      .select("fam_id")
      .eq("user_id", user.id);

    if (membersError) throw membersError;

    if (!memberships || memberships.length === 0) {
      return res.json({
        success: true,
        fams: [],
      });
    }

    const famIds = memberships.map((m: any) => m.fam_id);

    const { data: fams, error: famsError } = await supabase
      .from("creator_fams")
      .select(
        `
        *,
        creators!creator_id (id, user_id, creator_name)
      `
      )
      .in("id", famIds);

    if (famsError) throw famsError;

    res.json({
      success: true,
      fams: fams || [],
    });
  } catch (error) {
    console.error("Get user fams error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get user fams",
    });
  }
};
