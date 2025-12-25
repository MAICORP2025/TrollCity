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

export const handleGetConversations: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { data: members, error: membersError } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (membersError) throw membersError;

    if (!members || members.length === 0) {
      return res.json({
        success: true,
        conversations: [],
      });
    }

    const conversationIds = members.map((m: any) => m.conversation_id);

    const { data: conversations, error: conversationsError } = await supabase
      .from("conversation_members")
      .select(
        `
        conversation_id,
        user_id,
        last_read_at,
        users!user_id (id, username, display_name, avatar_url)
      `
      )
      .in("conversation_id", conversationIds)
      .neq("user_id", user.id);

    if (conversationsError) throw conversationsError;

    const { data: latestMessages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(conversationIds.length);

    if (messagesError) throw messagesError;

    const conversationMap = new Map<string, any>();
    conversations?.forEach((member: any) => {
      const key = member.conversation_id;
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          id: member.conversation_id,
          other_user: member.users,
          last_read_at: member.last_read_at,
          last_message: latestMessages?.find(
            (m: any) => m.conversation_id === member.conversation_id
          ),
        });
      }
    });

    res.json({
      success: true,
      conversations: Array.from(conversationMap.values()),
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get conversations",
    });
  }
};

export const handleGetMessages: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { conversationId } = req.params;

    const { data: messages, error } = await supabase
      .from("messages")
      .select(
        `
        *,
        sender:sender_id (id, username, display_name, avatar_url)
      `
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    await supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);

    res.json({
      success: true,
      messages: messages || [],
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get messages",
    });
  }
};

export const handleSendMessage: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { conversationId, content } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Get the other user in the conversation (should be the creator)
    const { data: members, error: membersError } = await supabase
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", user.id);

    if (membersError) throw membersError;

    if (!members || members.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid conversation",
      });
    }

    const otherUserId = members[0].user_id;

    // Check if the other user is a creator
    const { data: creator, error: creatorError } = await supabase
      .from("creators")
      .select("id")
      .eq("user_id", otherUserId)
      .single();

    if (creatorError && creatorError.code !== "PGRST116") throw creatorError;

    if (!creator) {
      // Not a creator, send message normally
      const { data: message, error } = await supabase
        .from("messages")
        .insert([
          {
            conversation_id: conversationId,
            sender_id: user.id,
            content,
            is_read: false,
          },
        ])
        .select(`
          *,
          sender:sender_id (id, username, display_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      return res.json({
        success: true,
        message,
      });
    }

    // Check payment requirements for creator messages
    const { data: pricing, error: pricingError } = await supabase
      .from("creator_message_pricing")
      .select("*")
      .eq("creator_id", creator.id)
      .single();

    if (pricingError && pricingError.code !== "PGRST116") throw pricingError;

    if (!pricing || !pricing.enabled) {
      // No pricing set or disabled, send message normally
      const { data: message, error } = await supabase
        .from("messages")
        .insert([
          {
            conversation_id: conversationId,
            sender_id: user.id,
            content,
            is_read: false,
          },
        ])
        .select(`
          *,
          sender:sender_id (id, username, display_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      return res.json({
        success: true,
        message,
      });
    }

    // Check if user is VIP
    const { data: vipPurchase, error: vipError } = await supabase
      .from("perk_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("creator_id", creator.id)
      .gte("expires_at", new Date().toISOString())
      .limit(1);

    if (vipError) throw vipError;

    if (pricing.vip_fans_message_free && vipPurchase && vipPurchase.length > 0) {
      // VIP fan, send message normally
      const { data: message, error } = await supabase
        .from("messages")
        .insert([
          {
            conversation_id: conversationId,
            sender_id: user.id,
            content,
            is_read: false,
          },
        ])
        .select(`
          *,
          sender:sender_id (id, username, display_name, avatar_url)
        `)
        .single();

      if (error) throw error;

      return res.json({
        success: true,
        message,
      });
    }

    // Check if user is in creator's fam
    const { data: famMember, error: famError } = await supabase
      .from("fam_members")
      .select("fam_id")
      .eq("user_id", user.id)
      .gte("expires_at", new Date().toISOString())
      .limit(1);

    if (famError) throw famError;

    let paymentAmount = pricing.coin_cost_per_message;

    if (famMember && famMember.length > 0 && pricing.fam_members_discount_percent > 0) {
      paymentAmount = Math.ceil(paymentAmount * (1 - pricing.fam_members_discount_percent / 100));
    }

    // Check daily free messages
    if (pricing.free_daily_messages > 0) {
      const today = new Date().toISOString().split('T')[0];
      const { data: dailyMessages, error: dailyError } = await supabase
        .from("messages")
        .select("id")
        .eq("sender_id", user.id)
        .gte("created_at", `${today}T00:00:00.000Z`)
        .lt("created_at", `${today}T23:59:59.999Z`);

      if (dailyError) throw dailyError;

      const paidMessagesToday = dailyMessages?.length || 0;

      if (paidMessagesToday < pricing.free_daily_messages) {
        // Within free daily limit, send message normally
        const { data: message, error } = await supabase
          .from("messages")
          .insert([
            {
              conversation_id: conversationId,
              sender_id: user.id,
              content,
              is_read: false,
            },
          ])
          .select(`
            *,
            sender:sender_id (id, username, display_name, avatar_url)
          `)
          .single();

        if (error) throw error;

        return res.json({
          success: true,
          message,
        });
      }
    }

    // Payment required - create message but don't send yet
    const { data: message, error } = await supabase
      .from("messages")
      .insert([
        {
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          is_read: false,
        },
      ])
      .select(`
        *,
        sender:sender_id (id, username, display_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message,
      requires_payment: true,
      payment_amount: paymentAmount,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to send message",
    });
  }
};

export const handleStartConversation: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { otherUserId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({
        success: false,
        error: "Missing otherUserId",
      });
    }

    const { data: existingMembers, error: membersError } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (membersError) throw membersError;

    const userConversationIds = existingMembers?.map((m: any) => m.conversation_id) || [];

    if (userConversationIds.length > 0) {
      const { data: otherUserMembers, error: otherError } = await supabase
        .from("conversation_members")
        .select("conversation_id")
        .eq("user_id", otherUserId)
        .in("conversation_id", userConversationIds);

      if (otherError) throw otherError;

      if (otherUserMembers && otherUserMembers.length > 0) {
        return res.json({
          success: true,
          conversationId: otherUserMembers[0].conversation_id,
        });
      }
    }

    const { data: newConversation, error: convError } = await supabase
      .from("conversations")
      .insert([{}])
      .select()
      .single();

    if (convError) throw convError;

    const { error: membersInsertError } = await supabase
      .from("conversation_members")
      .insert([
        {
          conversation_id: newConversation.id,
          user_id: user.id,
        },
        {
          conversation_id: newConversation.id,
          user_id: otherUserId,
        },
      ]);

    if (membersInsertError) throw membersInsertError;

    res.json({
      success: true,
      conversationId: newConversation.id,
    });
  } catch (error) {
    console.error("Start conversation error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to start conversation",
    });
  }
};

export const handleDeleteConversation: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { conversationId } = req.params;

    await supabase
      .from("conversation_members")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete conversation",
    });
  }
};

export const handleGetMessagePricing: RequestHandler = async (req, res) => {
  try {
    const { creatorId } = req.params;

    const { data: pricing, error } = await supabase
      .from("creator_message_pricing")
      .select("*")
      .eq("creator_id", creatorId)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    if (!pricing) {
      return res.json({
        success: true,
        pricing: null,
      });
    }

    res.json({
      success: true,
      pricing,
    });
  } catch (error) {
    console.error("Get message pricing error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get message pricing",
    });
  }
};

export const handleSetMessagePricing: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { creator_id, coin_cost_per_message, free_daily_messages, vip_fans_message_free, fam_members_discount_percent, enabled } = req.body;

    if (!creator_id) {
      return res.status(400).json({
        success: false,
        error: "Missing creator_id",
      });
    }

    const { data: pricing, error: _checkError } = await supabase
      .from("creator_message_pricing")
      .select("id")
      .eq("creator_id", creator_id)
      .single();

    let result;
    if (pricing) {
      const { data, error } = await supabase
        .from("creator_message_pricing")
        .update({
          coin_cost_per_message,
          free_daily_messages,
          vip_fans_message_free,
          fam_members_discount_percent,
          enabled,
        })
        .eq("creator_id", creator_id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("creator_message_pricing")
        .insert([
          {
            creator_id,
            coin_cost_per_message,
            free_daily_messages,
            vip_fans_message_free,
            fam_members_discount_percent,
            enabled,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({
      success: true,
      pricing: result,
    });
  } catch (error) {
    console.error("Set message pricing error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to set message pricing",
    });
  }
};

export const handlePayForMessage: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { messageId, creatorId, coinAmount } = req.body;

    if (!messageId || !creatorId || !coinAmount) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    if (user.coin_balance < coinAmount) {
      return res.status(400).json({
        success: false,
        error: "Insufficient coins",
      });
    }

    // Get creator's user_id from creators table (creatorId here is creators.id)
    const { data: creatorRecord, error: creatorRecordError } = await supabase
      .from("creators")
      .select("user_id")
      .eq("id", creatorId)
      .single();

    if (creatorRecordError) throw creatorRecordError;

    const creatorUserId = creatorRecord.user_id;

    // Start a transaction-like operation
    // First, deduct coins from sender
    const { error: deductError } = await supabase
      .from("users")
      .update({ coin_balance: user.coin_balance - coinAmount })
      .eq("id", user.id);

    if (deductError) throw deductError;

    // Add coins to creator's balance
    const { data: creator, error: creatorError } = await supabase
      .from("users")
      .select("coin_balance")
      .eq("id", creatorUserId)
      .single();

    if (creatorError) throw creatorError;

    const { error: addError } = await supabase
      .from("users")
      .update({ coin_balance: (creator.coin_balance || 0) + coinAmount })
      .eq("id", creatorUserId);

    if (addError) throw addError;

    // Update creator's total earnings
    const { data: creatorProfile, error: creatorProfileError } = await supabase
      .from("creators")
      .select("total_earnings")
      .eq("id", creatorId)
      .single();

    if (creatorProfileError) throw creatorProfileError;

    const { error: earningsError } = await supabase
      .from("creators")
      .update({ total_earnings: (creatorProfile.total_earnings || 0) + coinAmount })
      .eq("id", creatorId);

    if (earningsError) throw earningsError;

    // Record the payment
    const { data: payment, error } = await supabase
      .from("message_payments")
      .insert([
        {
          message_id: messageId,
          sender_id: user.id,
          creator_id: creatorId,
          coin_amount: coinAmount,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Create transaction records
    await supabase.from("transactions").insert([
      {
        user_id: user.id,
        amount: -coinAmount,
        type: "spend",
        description: `Paid for message to creator`,
      },
      {
        user_id: creatorUserId,
        amount: coinAmount,
        type: "grant", // Using grant for earnings since earn isn't in enum
        description: `Received payment for message`,
      },
    ]);

    res.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error("Pay for message error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process payment",
    });
  }
};

export const handleCheckMessagePayment: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { creatorId } = req.params;

    if (!creatorId) {
      return res.status(400).json({
        success: false,
        error: "Missing creatorId",
      });
    }

    // Get creator's pricing
    const { data: pricing, error: pricingError } = await supabase
      .from("creator_message_pricing")
      .select("*")
      .eq("creator_id", creatorId)
      .single();

    if (pricingError && pricingError.code !== "PGRST116") throw pricingError;

    if (!pricing || !pricing.enabled) {
      return res.json({
        success: true,
        requires_payment: false,
        payment_amount: 0,
      });
    }

    // Check if user is VIP (has purchased perks from this creator)
    const { data: vipPurchase, error: vipError } = await supabase
      .from("perk_purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("creator_id", creatorId)
      .gte("expires_at", new Date().toISOString())
      .limit(1);

    if (vipError) throw vipError;

    if (pricing.vip_fans_message_free && vipPurchase && vipPurchase.length > 0) {
      return res.json({
        success: true,
        requires_payment: false,
        payment_amount: 0,
        reason: "VIP fan - messages are free",
      });
    }

    // Check if user is in creator's fam
    const { data: famMember, error: famError } = await supabase
      .from("fam_members")
      .select("fam_id")
      .eq("user_id", user.id)
      .gte("expires_at", new Date().toISOString())
      .limit(1);

    if (famError) throw famError;

    let paymentAmount = pricing.coin_cost_per_message;

    if (famMember && famMember.length > 0 && pricing.fam_members_discount_percent > 0) {
      paymentAmount = Math.ceil(paymentAmount * (1 - pricing.fam_members_discount_percent / 100));
    }

    // Check daily free messages
    if (pricing.free_daily_messages > 0) {
      const today = new Date().toISOString().split('T')[0];
      const { data: dailyMessages, error: dailyError } = await supabase
        .from("messages")
        .select("id")
        .eq("sender_id", user.id)
        .gte("created_at", `${today}T00:00:00.000Z`)
        .lt("created_at", `${today}T23:59:59.999Z`);

      if (dailyError) throw dailyError;

      const paidMessagesToday = dailyMessages?.length || 0;

      if (paidMessagesToday < pricing.free_daily_messages) {
        return res.json({
          success: true,
          requires_payment: false,
          payment_amount: 0,
          reason: `Free daily message (${paidMessagesToday + 1}/${pricing.free_daily_messages})`,
        });
      }
    }

    res.json({
      success: true,
      requires_payment: true,
      payment_amount: paymentAmount,
    });
  } catch (error) {
    console.error("Check message payment error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to check payment requirements",
    });
  }
};

export const handleGetDailyMessageCount: RequestHandler = async (req, res) => {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    const { creatorId } = req.params;

    if (!creatorId) {
      return res.status(400).json({
        success: false,
        error: "Missing creatorId",
      });
    }

    // Get creator's pricing
    const { data: pricing, error: pricingError } = await supabase
      .from("creator_message_pricing")
      .select("free_daily_messages")
      .eq("creator_id", creatorId)
      .single();

    if (pricingError && pricingError.code !== "PGRST116") throw pricingError;

    const freeMessages = pricing?.free_daily_messages || 0;

    // Count messages sent today
    const today = new Date().toISOString().split('T')[0];
    const { data: dailyMessages, error: dailyError } = await supabase
      .from("messages")
      .select("id")
      .eq("sender_id", user.id)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lt("created_at", `${today}T23:59:59.999Z`);

    if (dailyError) throw dailyError;

    const dailyCount = dailyMessages?.length || 0;
    const freeMessagesRemaining = Math.max(0, freeMessages - dailyCount);

    res.json({
      success: true,
      daily_count: dailyCount,
      free_messages_remaining: freeMessagesRemaining,
    });
  } catch (error) {
    console.error("Get daily message count error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get daily message count",
    });
  }
};

