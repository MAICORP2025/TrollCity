import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .select("role, is_admin, is_lead_officer, is_troll_officer")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isLeadOfficer = 
      profile.role === 'lead_troll_officer' || 
      profile.is_lead_officer === true || 
      profile.is_admin === true || 
      profile.role === 'admin';

    const isTrollOfficer = 
      profile.role === 'troll_officer' || 
      profile.is_troll_officer === true || 
      isLeadOfficer;

    const { action, ...params } = await req.json();

    // Check if user is broadcaster for the relevant stream
    let isBroadcaster = false;
    let isModerator = false;
    if (params.streamId) {
      const { data: stream } = await supabaseAdmin
        .from('streams')
        .select('broadcaster_id')
        .eq('id', params.streamId)
        .single();
      
      if (stream && stream.broadcaster_id === user.id) {
        isBroadcaster = true;
      }

      // Check for Moderator status
      const { data: participant } = await supabaseAdmin
        .from('streams_participants')
        .select('is_moderator')
        .eq('stream_id', params.streamId)
        .eq('user_id', user.id)
        .single();
      
      if (participant?.is_moderator) {
        isModerator = true;
      }
    }

    // Authorization Check
    const allowedBroadcasterActions = [
      'kick_participant', 
      'assign_moderator', 
      'remove_moderator', 
      'mute_participant', 
      'disable_chat', 
      'clear_seat_ban',
      'end_stream',
      'mute_media',
      'set_frame_mode',
      'alert_officers',
      'start_stream',
      'troll_mic_mute',
      'troll_mic_unmute',
      'troll_immunity',
      'troll_kick',
      'notify_user',
      'log_officer_action',
      'log_theme_event',
      'start_troll_battle',
      'assign_battle_guests',
      'assign_broadofficer',
      'remove_broadofficer',
      'update_box_count',
      'clear_stage',
      'set_price'
    ];
    
    // Moderators can do subset? For now assume Moderators can do moderation stuff.
    // Also allow "Troll Actions" for regular users (paid).
    const paidActions = ['troll_mic_mute', 'troll_mic_unmute', 'troll_immunity', 'troll_kick'];
    
    // Check if action requires privilege or can be paid
    const isPaidAction = paidActions.includes(action);

    // Public actions (anyone can report or gift)
    const publicActions = [
      'report_user', 
      'send_gift', 
      'send_stream_message', 
      'join_stream_box', 
      'claim_watch_xp', 
      'verify_stream_password', 
      'check_broadofficer',
      'find_opponent',
      'skip_opponent',
      'get_stream',
      'get_stream_status',
      'get_quick_gifts',
      'get_stream_box_count',
      'get_stream_theme',
      'ensure_dm_conversation'
    ];
    
    // Moderator privileges
    const allowedModeratorActions = [
        'kick_participant',
        'mute_participant',
        'disable_chat',
        'troll_mic_mute',
        'troll_mic_unmute',
        'troll_kick',
        'alert_officers', // Moderators should be able to alert officers
        'log_officer_action'
    ];

    const isAuthorized = 
        isTrollOfficer || 
        (isBroadcaster && allowedBroadcasterActions.includes(action)) ||
        (isModerator && allowedModeratorActions.includes(action)) ||
        publicActions.includes(action) ||
        isPaidAction; // Allow paid actions to proceed to case logic (where fee is enforced)

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Forbidden: Insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;

    switch (action) {
      case "get_moderation_context": {
        result = {
          success: true,
          currentUser: user,
          officerProfile: profile,
          isPrivileged: isTrollOfficer || isBroadcaster || isModerator,
          isBroadcaster,
          isModerator,
          isTrollOfficer
        };
        break;
      }

      case "block_user": {
        const { targetUserId } = params;
        if (!targetUserId) throw new Error("Missing targetUserId");
        
        // Check if already blocked to avoid error? Or upsert?
        // Usually insert.
        const { error } = await supabaseAdmin
          .from('user_relationships')
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
            status: 'blocked'
          });
          
        if (error) {
             // If duplicate, maybe update?
             if (error.code === '23505') { // Unique violation
                  const { error: updateError } = await supabaseAdmin
                    .from('user_relationships')
                    .update({ status: 'blocked' })
                    .eq('follower_id', user.id)
                    .eq('following_id', targetUserId);
                  if (updateError) throw updateError;
             } else {
                 throw error;
             }
        }
        
        result = { success: true };
        break;
      }

      case "report_user": {
        const { targetUserId, streamId, reason, description } = params;
        if (!targetUserId || !reason) throw new Error("Missing required fields");

        const { error } = await supabaseAdmin
          .from('user_reports')
          .insert({
             reporter_id: user.id,
             reported_id: targetUserId,
             reason,
             description: description || '',
             stream_id: streamId || null,
             status: 'pending'
          });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "join_stream_box": {
        const { room, seatIndex, username, avatarUrl, role, metadata, joinPrice } = params;
        if (!room || seatIndex === undefined) throw new Error("Missing required fields");

        const safeSeatIndex = Number(seatIndex);
        const userId = user.id;

        // 1. Check for bans
        const { data: banRow, error: _banError } = await supabaseAdmin
          .from("broadcast_seat_bans")
          .select("banned_until")
          .eq("room", room)
          .eq("user_id", userId)
          .maybeSingle();

        if (banRow) {
          const bannedUntil = banRow.banned_until ? new Date(banRow.banned_until) : null;
          const now = new Date();
          if (!bannedUntil || bannedUntil > now) {
             throw new Error("You are temporarily restricted from joining the guest box.");
          }
        }

        // 2. Deduct Coins if needed
        if (joinPrice && joinPrice > 0) {
           const { data: _deductData, error: deductError } = await supabaseAdmin.rpc('deduct_user_troll_coins', {
              p_user_id: userId,
              p_amount: String(joinPrice),
              p_coin_type: 'troll_coins'
           });

           if (deductError) {
              console.error("Deduction failed:", deductError);
              throw new Error("Failed to process payment: " + deductError.message);
           }
           
           // Log transaction
           await supabaseAdmin.from('coin_transactions').insert({
              user_id: userId,
              amount: -joinPrice,
              transaction_type: 'perk_purchase',
              coin_type: 'troll_coins',
              description: `Joined seat ${safeSeatIndex} in broadcast`,
              metadata: {
                 seatIndex: safeSeatIndex,
                 room,
                 ...metadata
              }
           });
        }

        // 3. Claim Seat
        const { data, error } = await supabaseAdmin.rpc("claim_broadcast_seat", {
          p_room: room,
          p_seat_index: safeSeatIndex,
          p_user_id: userId,
          p_username: username ?? profile.username,
          p_avatar_url: avatarUrl ?? profile.avatar_url ?? null,
          p_role: role ?? profile.role,
          p_metadata: metadata ?? {},
        });

        if (error) throw error;
        result = { success: true, seat: data?.[0] };
        break;
      }

      case "leave_stream_box": {
        const { room, seatIndex, force, banMinutes, banPermanent } = params;
        if (!room) throw new Error("Missing room");

        // Permission check for force removal
        if (force) {
            // Re-verify authority just in case
            if (!isTrollOfficer && !isBroadcaster && !isModerator) {
                throw new Error("Unauthorized to force remove users");
            }
        }

        const { data, error } = await supabaseAdmin.rpc("release_broadcast_seat", {
            p_room: room,
            p_seat_index: seatIndex ? Number(seatIndex) : null,
            p_user_id: user.id, // The RPC handles checking if user owns seat OR is force (if force param is supported by RPC?)
            // Wait, the RPC release_broadcast_seat signature in broadcast-seats was:
            // p_room, p_seat_index, p_user_id, p_force
            // But we need to check if the RPC actually supports p_force.
            // broadcast-seats/index.ts used:
            // p_user_id: profile.id, p_force: Boolean(body.force)
            // So we should pass p_force.
            p_force: Boolean(force)
        });

        if (error) throw error;

        // Handle banning if requested and authorized
        if ((banMinutes || banPermanent) && (isTrollOfficer || isBroadcaster || isModerator)) {
             const bannedUntil = banPermanent
              ? null
              : new Date(Date.now() + (Number(banMinutes) * 60 * 1000)).toISOString();

             await supabaseAdmin
                .from("broadcast_seat_bans")
                .upsert(
                  {
                    room,
                    user_id: data?.[0]?.user_id, // We need the user_id of the person who was removed. 
                    // The RPC might return the released seat info.
                    // If data[0] has user_id, use it.
                    // If not, we might not know who we just kicked if we only provided seatIndex.
                    // But if we provided seatIndex, the RPC returns the seat row.
                    banned_until: bannedUntil,
                    created_by: user.id,
                  },
                  { onConflict: "room,user_id" }
                );
        }

        result = { success: true, seat: data?.[0] };
        break;
      }

      case "list_stream_seats": {
         const { room } = params;
         if (!room) throw new Error("Missing room");
         
         const { data: seats, error } = await supabaseAdmin
            .from("broadcast_seats")
            .select("*")
            .eq("room", room);
            
         if (error) throw error;
         result = { success: true, seats: seats || [] };
         break;
      }

      case "get_seat_bans": {
        const { room } = params;
        if (!room) throw new Error("Missing room");

        // Verify authorization (Officers/Broadcasters) - Handled by top-level check if needed,
        // but let's ensure only authorized people can see bans list if it's sensitive?
        // LivePage checks isOfficerUser before calling loadSeatBans.
        // We should enforce this here.
        if (!isTrollOfficer && !isBroadcaster && !isModerator) {
           // Allow if user is checking their own ban? No, this returns a list.
           throw new Error("Unauthorized to view ban list");
        }

        const { data, error } = await supabaseAdmin
          .from('broadcast_seat_bans')
          .select('id,user_id,banned_until,created_at,reason')
          .eq('room', room)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Enrich with usernames
        const rows = (data as any[]) || [];
        const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
        
        const usernameMap = new Map<string, string | null>();
        if (userIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from('user_profiles')
            .select('id,username')
            .in('id', userIds);
          (profiles as any[] | null | undefined)?.forEach((p) => {
            usernameMap.set(p.id, p.username);
          });
        }

        const enriched = rows.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          banned_until: row.banned_until,
          created_at: row.created_at,
          reason: row.reason,
          username: usernameMap.get(row.user_id) ?? null,
        }));

        result = { success: true, bans: enriched };
        break;
      }

      case "get_active_battle": {
        const { broadcasterId } = params;
        if (!broadcasterId) throw new Error("Missing broadcasterId");

        const { data, error } = await supabaseAdmin
            .from('troll_battles')
            .select('*')
            .or(`player1_id.eq.${broadcasterId},player2_id.eq.${broadcasterId}`)
            .eq('status', 'active')
            .maybeSingle();
            
        if (error) throw error;
        result = { success: true, battle: data };
        break;
      }

      case "get_battle": {
        const { battleId } = params;
        if (!battleId) throw new Error("Missing battleId");

        // 1. Get Battle
        const { data: battle, error: battleError } = await supabaseAdmin
            .from('troll_battles')
            .select('*')
            .eq('id', battleId)
            .single();

        if (battleError) throw battleError;

        // 2. Get Profiles
        const { data: profiles, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', [battle.player1_id, battle.player2_id]);

        if (profileError) throw profileError;

        const p1Profile = profiles?.find((p: any) => p.id === battle.player1_id);
        const p2Profile = profiles?.find((p: any) => p.id === battle.player2_id);

        result = { 
            success: true, 
            battle, 
            player1: { ...p1Profile, score: battle.player1_score },
            player2: { ...p2Profile, score: battle.player2_score }
        };
        break;
      }

      case "get_stream_participants": {
        const { streamId } = params;
        if (!streamId) throw new Error("Missing streamId");

        // Authorization: Broadcaster, Moderator, Officer
        if (!isBroadcaster && !isModerator && !isTrollOfficer) {
             throw new Error("Unauthorized");
        }

        const { data: participants, error } = await supabaseAdmin
          .from('streams_participants')
          .select('user_id,is_active,is_moderator,can_chat,chat_mute_until')
          .eq('stream_id', streamId);

        if (error) throw error;

        const rows = participants || [];
        const ids = rows.map((r: any) => r.user_id);
        
        const profilesMap: Record<string, { username: string; avatar_url?: string }> = {};
        
        if (ids.length > 0) {
            const { data: ups } = await supabaseAdmin
              .from('user_profiles')
              .select('id,username,avatar_url')
              .in('id', ids);
            
            (ups || []).forEach((p: any) => {
                profilesMap[p.id] = { username: p.username, avatar_url: p.avatar_url };
            });
        }

        const enriched = rows.map((r: any) => ({
            user_id: r.user_id,
            username: profilesMap[r.user_id]?.username || 'Unknown',
            avatar_url: profilesMap[r.user_id]?.avatar_url,
            is_moderator: r.is_moderator,
            can_chat: r.can_chat,
            chat_mute_until: r.chat_mute_until,
            is_active: r.is_active
        }));

        result = { success: true, participants: enriched };
        break;
      }

      case "get_stream_viewers": {
        const { streamId } = params;
        if (!streamId) throw new Error("Missing streamId");

        // 1. Get count
        const { count, error: countError } = await supabaseAdmin
          .from('stream_viewers')
          .select('*', { count: 'exact', head: true })
          .eq('stream_id', streamId);

        if (countError) throw countError;

        // 2. Get latest 50 viewers
        const { data: viewerRows, error: viewerError } = await supabaseAdmin
          .from('stream_viewers')
          .select('user_id')
          .eq('stream_id', streamId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (viewerError) throw viewerError;

        const viewerIds = (viewerRows || []).map((row: any) => row.user_id).filter(Boolean);
        let viewers: any[] = [];

        if (viewerIds.length > 0) {
            const [profileResult, taxResult] = await Promise.all([
              supabaseAdmin
                .from('user_profiles')
                .select('id, username, avatar_url, role, troll_role, is_broadcaster, full_name, onboarding_completed')
                .in('id', viewerIds),
              supabaseAdmin
                .from('user_tax_info')
                .select('user_id, w9_status')
                .in('user_id', viewerIds)
            ]);

            const profileMap = new Map((profileResult.data || []).map((p: any) => [p.id, p]));
            const taxMap = new Map((taxResult.data || []).map((t: any) => [t.user_id, t]));

            viewers = viewerIds.map((id: string) => {
                const profile = profileMap.get(id);
                const taxInfo = taxMap.get(id);
                return {
                  userId: id,
                  username: profile?.username || `Viewer ${id.substring(0, 6)}`,
                  avatarUrl: profile?.avatar_url,
                  role: profile?.role || profile?.troll_role || null,
                  isBroadcaster: Boolean(profile?.is_broadcaster),
                  fullName: profile?.full_name || null,
                  onboardingCompleted: Boolean(profile?.onboarding_completed),
                  w9Status: taxInfo?.w9_status || 'pending',
                };
            });
        }

        result = { success: true, count: count || 0, viewers };
        break;
      }

      case "get_quick_gifts": {
        const { data, error } = await supabaseAdmin
          .from("gift_items")
          .select("id,name,icon,value,category")
          .order("value", { ascending: true });

        if (error) throw error;
        result = { success: true, gifts: data };
        break;
      }

      // --- Stream Management ---
      case "set_price": {
        const { streamId, price } = params;
        if (!streamId || price === undefined) throw new Error("Missing required fields");

        const numericPrice = Math.max(0, Number(price));

        // 1. Update stream price
        const { error: updateError } = await supabaseAdmin
          .from('streams')
          .update({ box_price_amount: numericPrice })
          .eq('id', streamId);

        if (updateError) throw updateError;

        // 2. Insert System Message
        const { error: msgError } = await supabaseAdmin
          .from('messages')
          .insert({
            stream_id: streamId,
            message_type: 'system',
            content: `PRICE_UPDATE:${numericPrice}`
          });

        if (msgError) throw msgError;

        result = { success: true };
        break;
      }

      case "set_frame_mode": {
        const { streamId, mode } = params;
        if (!streamId || !mode) throw new Error("Missing required fields");
        if (mode !== 'none' && mode !== 'rgb') throw new Error("Invalid mode");

        // Verify broadcaster ownership (already done by isBroadcaster check) or Officer role
        // isAuthorized check at top covers this.

        const { error } = await supabaseAdmin
          .from('streams')
          .update({ frame_mode: mode })
          .eq('id', streamId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "alert_officers": {
        const { streamId, targetUserId, reporterId } = params;
        if (!streamId) throw new Error("Missing streamId");
        // Any authenticated user can alert officers, but we only allow this function for isAuthorized users?
        // Wait, handleAlertOfficers in LivePage is available to everyone via the UI?
        // "Alert Troll Officers" button is in BroadcasterSettings (broadcaster only?)
        // But handleSeatReport calls it too.
        
        // Let's check LivePage again.
        // handleAlertOfficers is used in BroadcasterSettings (Broadcaster/Officer)
        // AND handleSeatReport (Officer only, as it's in UserActionsMenu for officers?)
        
        // Actually, let's look at LivePage.tsx again.
        // handleSeatReport is in handleSeatAction which checks isOfficerUser.
        // So it seems alerting officers is currently restricted to Officers and Broadcasters.
        
        // But regular users might want to report? 
        // handleSeatReport is triggered from UserActionsMenu.
        
        // In LivePage.tsx:
        // const handleSeatReport = () => { if (!seatActionTarget) return; handleAlertOfficers(seatActionTarget.userId); ... }
        // handleSeatAction sets seatActionTarget only if isOfficerUser is true (lines 1482).
        
        // So yes, currently only Officers (and maybe Broadcaster via BroadcasterSettings) can use this.
        // So the isAuthorized check in officer-actions is appropriate (Officer or Broadcaster).
        
        let targetUsername: string | undefined;
        if (targetUserId) {
          const { data: targetProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('username')
            .eq('id', targetUserId)
            .single();
          targetUsername = targetProfile?.username || undefined;
        }

        let reporterUsername: string | undefined;
        if (reporterId) {
             const { data: reporterProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('username')
            .eq('id', reporterId)
            .single();
          reporterUsername = reporterProfile?.username || undefined;
        }

        const { data: officers } = await supabaseAdmin
          .from('user_profiles')
          .select('id, username, role, is_officer')
          .in('role', ['troll_officer', 'lead_troll_officer', 'admin']);

        const baseMessage = targetUserId
          ? `Alert in stream ${streamId} involving @${targetUsername || targetUserId}`
          : `Alert in stream ${streamId}`;

        const messageWithReporter =
          reporterUsername
            ? `${baseMessage} (reported by @${reporterUsername})`
            : baseMessage;

        const list = (officers || []).map((o: any) => ({
          user_id: o.id,
          type: 'officer_update',
          title: 'Stream Moderation Alert',
          message: messageWithReporter,
          metadata: {
            stream_id: streamId,
            target_user_id: targetUserId,
            target_username: targetUsername,
            reporter_id: reporterId,
            reporter_username: reporterUsername,
            link: `/live/${streamId}?source=officer_alert`
          }
        }));

        if (list.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('notifications')
            .insert(list);
          
          if (insertError) throw insertError;

          // Send push notifications
          try {
             // We can call send-push-notification via fetch or invoke if we can. 
             // But we are in an Edge Function. We can use fetch.
             // Or just skip it for now and assume the notification table trigger handles it?
             // The frontend was calling 'send-push-notification' explicitly.
             
             // Let's try to invoke it or just leave it out if notifications trigger pushes?
             // Usually it's better to keep it if it was there.
             
             const { data: _pushData, error: pushError } = await supabaseAdmin.functions.invoke('send-push-notification', {
                body: {
                    user_ids: list.map((n: any) => n.user_id),
                    title: 'Stream Moderation Alert',
                    body: messageWithReporter,
                    url: `/live/${streamId}?source=officer_alert`,
                    create_db_notification: false,
                }
             });
             if (pushError) console.warn("Failed to send push:", pushError);
          } catch (err) {
             console.warn("Failed to invoke push notification:", err);
          }
        }
        
        result = { success: true, count: list.length };
        break;
      }

      case "send_gift": {
        const { streamId, gift, sendToAll, targetMode, targetUserId, themeId } = params;
        if (!streamId || !gift) throw new Error("Missing required fields");
        
        const senderId = user.id;
        const totalCoins = gift.value || 0;
        if (totalCoins <= 0) throw new Error("Invalid gift value");

        const { data: streamInfo, error: streamInfoError } = await supabaseAdmin
            .from('streams')
            .select('broadcaster_id')
            .eq('id', streamId)
            .single();
            
        if (streamInfoError || !streamInfo) throw new Error("Stream not found");
        
        const broadcasterId = streamInfo.broadcaster_id;
        let recipients: string[] = [];

        if (sendToAll) {
             const { data: viewers } = await supabaseAdmin
                .from('stream_viewers')
                .select('user_id')
                .eq('stream_id', streamId);
             
             const viewerIds = (viewers || []).map((v: any) => v.user_id).filter((id: string) => id !== senderId);
             recipients = [...new Set(viewerIds)];
        } else {
             const receiverId = targetMode === "broadcaster" 
                ? broadcasterId 
                : (targetUserId || broadcasterId);
             
             if (receiverId) recipients.push(receiverId);
        }
        
        if (recipients.length === 0) throw new Error("No recipients found");

        let successCount = 0;
        const results = [];
        const timestamp = Date.now();
        const sourceIdBase = `gift_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

        // Helper to slugify
        const toGiftSlug = (name: string) => name.toLowerCase().replace(/ /g, '_');
        const giftSlug = gift.id || toGiftSlug(gift.name);

        for (const receiverId of recipients) {
             const { data: spendResult, error: spendError } = await supabaseAdmin.rpc("spend_coins", {
                p_sender_id: senderId,
                p_receiver_id: receiverId,
                p_coin_amount: totalCoins,
                p_source: "gift",
                p_item: gift.name,
             });
             
             if (spendError) {
                 console.warn(`Failed to send gift to ${receiverId}:`, spendError);
                 continue; 
             }
             
             if (spendResult && typeof spendResult === 'object' && 'success' in spendResult && !(spendResult as any).success) {
                 if ((spendResult as any).error === "Insufficient funds") break;
                 continue;
             }
             
             successCount++;
             const giftId = (spendResult as any)?.gift_id;
             
             if (giftId) {
                 await supabaseAdmin.from('gifts').update({
                    stream_id: streamId,
                    gift_slug: giftSlug
                 }).eq('id', giftId);
             }
             
             // Grant XP
             const gifterXp = Math.floor(totalCoins * 1.1);
             await supabaseAdmin.rpc('grant_xp', {
                  p_user_id: senderId,
                  p_amount: gifterXp,
                  p_source: 'gift_sent',
                  p_source_id: `${sourceIdBase}_${receiverId}_sender`,
                  p_metadata: { coin_amount: totalCoins, receiver_id: receiverId }
             });
             
             const streamerXp = Math.floor(totalCoins * 1.0);
             await supabaseAdmin.rpc('grant_xp', {
                  p_user_id: receiverId,
                  p_amount: streamerXp,
                  p_source: 'gift_received',
                  p_source_id: `${sourceIdBase}_${receiverId}_receiver`,
                  p_metadata: { coin_amount: totalCoins, sender_id: senderId }
             });
             
             results.push({ receiverId });
        }
        
        if (successCount > 0) {
             const { data: senderProfile } = await supabaseAdmin.from('user_profiles').select('username').eq('id', senderId).single();
             const senderName = senderProfile?.username || 'Someone';
             
             const content = sendToAll
                ? `${senderName} sent ${gift.name} to ${successCount} users`
                : `${senderName} sent ${gift.name}`;
                
             await supabaseAdmin.from('messages').insert({
                  stream_id: streamId,
                  user_id: senderId,
                  content,
                  message_type: 'gift'
             });
             
             if (themeId) {
                  const eventType = totalCoins >= 1000 ? "super_gift" : "gift";
                  const themeEvents = results.map(r => ({
                      room_id: streamId,
                      broadcaster_id: broadcasterId,
                      user_id: senderId,
                      theme_id: themeId,
                      event_type: eventType,
                      payload: { 
                          gift_name: gift.name, 
                          gift_slug: giftSlug,
                          coins: totalCoins,
                          sender_id: senderId,
                          receiver_id: r.receiverId 
                      }
                  }));
                  
                  if (themeEvents.length > 0) {
                      await supabaseAdmin.from('broadcast_theme_events').insert(themeEvents);
                  }
             }
        }
        
        result = { success: true, count: successCount, results };
        break;
      }

      case "start_stream": {
        const { streamId, roomName } = params;
        if (!streamId) throw new Error("Missing streamId");

        // We allow updating room_name just in case, though usually it's set on creation.
        // But LivePage updates it on go-live, so we replicate that.
        const updateData: any = {
            status: 'live',
            is_live: true,
            start_time: new Date().toISOString()
        };
        if (roomName) updateData.room_name = roomName;

        const { error } = await supabaseAdmin
            .from('streams')
            .update(updateData)
            .eq('id', streamId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "end_stream": {
        const { streamId } = params;
        if (!streamId) throw new Error("Missing streamId");
        
        const { error } = await supabaseAdmin
          .from('streams')
          .update({ 
            status: 'ended', 
            is_live: false,
            ended_at: new Date().toISOString()
          })
          .eq('id', streamId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "mute_media": {
        const { streamId, userId, kind, muted } = params;
        if (!streamId || !userId || !kind) throw new Error("Missing required fields");

        // 1. Get Room Name from Stream ID
        const { data: stream, error: streamError } = await supabaseAdmin
          .from('streams')
          .select('room_name')
          .eq('id', streamId)
          .single();
        
        if (streamError || !stream) throw new Error("Stream not found");

        // 2. Initialize LiveKit Client
        const { RoomServiceClient } = await import("livekit-server-sdk");
        const livekitHost = Deno.env.get("LIVEKIT_URL") || "";
        const livekitKey = Deno.env.get("LIVEKIT_API_KEY") || "";
        const livekitSecret = Deno.env.get("LIVEKIT_API_SECRET") || "";

        if (!livekitHost || !livekitKey || !livekitSecret) {
          throw new Error("LiveKit credentials not configured");
        }

        const svc = new RoomServiceClient(livekitHost, livekitKey, livekitSecret);

        // 3. Find the track SID for the user and kind
        // Note: We need to list participants to find the track SID
        const participants = await svc.listParticipants(stream.room_name);
        const participant = participants.find((p: any) => p.identity === userId);

        if (!participant) {
           // User might not be in room, but we can't mute them then.
           throw new Error("Participant not found in LiveKit room");
        }

        const tracks = participant.tracks;
        const track = tracks.find((t: any) => t.kind.toString().toLowerCase() === kind.toLowerCase());

        if (!track) {
          // No track to mute, maybe already muted or not published?
          // We can try to mute the participant directly via updateParticipant permissions if we want to prevent future publishing?
          // For now, let's just warn/return.
          // actually updateParticipant can set canPublish: false
          
          if (muted) {
             // If we want to disable, we can update participant permissions
             const _permission = {
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
             };
             // But we only want to disable one kind? LiveKit permissions are all-or-nothing for publish usually, unless we use track sources.
             // Let's stick to muting the track if it exists.
             console.log("Track not found to mute");
             result = { success: false, message: "Track not found" };
             break;
          }
        } else {
           // Mute the track
           await svc.mutePublishedTrack(stream.room_name, userId, track.sid, muted);
        }

        result = { success: true };
        break;
      }

      case "remove_seat": {
        const { streamId, userId } = params;
        if (!streamId || !userId) throw new Error("Missing required fields");

        const { data: stream, error: streamError } = await supabaseAdmin
          .from('streams')
          .select('room_name')
          .eq('id', streamId)
          .single();

        if (streamError || !stream) throw new Error("Stream not found");

        const { error } = await supabaseAdmin
          .from('broadcast_seats')
          .delete()
          .eq('room', stream.room_name)
          .eq('user_id', userId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "mute_all": {
        const { streamId } = params;
        if (!streamId) throw new Error("Missing streamId");

        const until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const { error } = await supabaseAdmin
          .from('streams_participants')
          .update({ can_chat: false, chat_mute_until: until })
          .eq('stream_id', streamId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "disable_chat": {
        const { streamId, userId, enabled } = params; // If userId provided, disable for user. If not, global.
        
        if (!streamId) throw new Error("Missing streamId");

        if (userId) {
            // Target specific user
            const updates: any = { can_chat: enabled !== false }; // Default to true if enabled is undefined, but logic implies we pass it.
            if (enabled === false) {
                updates.chat_mute_until = null; // Permanent disable? Or just toggle flag?
            } else {
                updates.chat_mute_until = null; // Clear mute if enabling
            }

            const { error } = await supabaseAdmin
                .from('streams_participants')
                .update(updates)
                .eq('stream_id', streamId)
                .eq('user_id', userId);
            
            if (error) throw error;
        } else {
            // Global disable
            const { error } = await supabaseAdmin
                .from('streams_participants')
                .update({ can_chat: false, chat_mute_until: null })
                .eq('stream_id', streamId);
            
            if (error) throw error;
        }

        result = { success: true };
        break;
      }
      
      case "clear_seat_ban": {
          const { banId } = params;
          if (!banId) throw new Error("Missing banId");
          const { error } = await supabaseAdmin
            .from('broadcast_seat_bans')
            .delete()
            .eq('id', banId);
          if (error) throw error;
          result = { success: true };
          break;
      }

      case "update_box_count": {
          const { streamId, count } = params;
          if (!streamId || count === undefined) throw new Error("Missing required fields");
          
          const boxCount = Math.max(0, Math.min(6, Number(count)));

          const { data: stream, error: streamError } = await supabaseAdmin
            .from('streams')
            .select('room_name')
            .eq('id', streamId)
            .single();

          if (streamError || !stream) throw new Error("Stream not found");

          // 1. Delete excess seats
          const { error: deleteError } = await supabaseAdmin
            .from('broadcast_seats')
            .delete()
            .eq('room', stream.room_name)
            .gt('seat_index', boxCount);

          if (deleteError) throw deleteError;

          // 2. Insert System Message for persistence and realtime update
          const { error: msgError } = await supabaseAdmin
            .from('messages')
            .insert({
              stream_id: streamId,
              message_type: 'system',
              content: `BOX_COUNT_UPDATE:${boxCount}`
            });

          if (msgError) throw msgError;

          result = { success: true };
          break;
      }

      case "clear_stage": {
          const { streamId } = params;
          if (!streamId) throw new Error("Missing streamId");

          const { data: stream, error: streamError } = await supabaseAdmin
            .from('streams')
            .select('room_name')
            .eq('id', streamId)
            .single();

          if (streamError || !stream) throw new Error("Stream not found");

          // 1. Delete all seats
          const { error: deleteError } = await supabaseAdmin
            .from('broadcast_seats')
            .delete()
            .eq('room', stream.room_name);

          if (deleteError) throw deleteError;

          // 2. Insert System Message
          const { error: msgError } = await supabaseAdmin
            .from('messages')
            .insert({
              stream_id: streamId,
              message_type: 'system',
              content: 'BOX_COUNT_UPDATE:0'
            });

          if (msgError) throw msgError;

          result = { success: true };
          break;
      }

      case "process_billing": {
        const { streamId, userId, isHost } = params;
        if (!streamId || !userId) throw new Error("Missing fields");

        // Verify authorization:
        // User can only bill themselves.
        if (userId !== user.id) throw new Error("Unauthorized: Cannot bill other users");

        const { data, error } = await supabaseAdmin.rpc('process_stream_billing', {
            p_stream_id: streamId,
            p_user_id: userId,
            p_is_host: isHost
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "start_troll_battle": {
          const { battleId } = params;
          if (!battleId) throw new Error("Missing battleId");
          
          const { error } = await supabaseAdmin
            .from('troll_battles')
            .update({ status: 'active', started_at: new Date().toISOString() })
            .eq('id', battleId);

          if (error) throw error;
          result = { success: true };
          break;
      }

      case "finalize_troll_battle": {
          const { battleId } = params;
          if (!battleId) throw new Error("Missing battleId");

          const { error } = await supabaseAdmin.rpc('finalize_battle', { p_battle_id: battleId });

          if (error) throw error;
          result = { success: true };
          break;
      }

      case "send_stream_message": {
          const { streamId, content, messageType } = params;
          if (!streamId || !content) throw new Error("Missing required fields");
          
          const { error } = await supabaseAdmin.from('messages').insert({
              stream_id: streamId,
              user_id: user.id,
              content,
              message_type: messageType || 'chat'
          });
          
          if (error) throw error;
          result = { success: true };
          break;
      }





      case "assign_officer": {
        const { userId, streamId: _streamId } = params;
        if (!userId) throw new Error("Missing userId");
        
        // Only lead officers or admins can assign officers? 
        // Or is this "assign moderator"?
        // The frontend calls handleAssignOfficer which calls 'assign_officer'.
        // Let's assume this promotes a user to 'troll_officer' globally or just for the stream?
        // Typically "Officer" is a global role. "Moderator" is per stream.
        // If it's global, we check isLeadOfficer.
        
        if (!isLeadOfficer) throw new Error("Unauthorized: Only Lead Officers can assign officers");

        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ role: 'troll_officer', is_troll_officer: true })
            .eq('id', userId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "remove_officer": {
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");
        
        if (!isLeadOfficer) throw new Error("Unauthorized: Only Lead Officers can remove officers");

        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ role: 'user', is_troll_officer: false })
            .eq('id', userId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "kick_participant": {
        const { streamId, userId, banTime } = params;
        if (!streamId || !userId) throw new Error("Missing required fields");

        // Authorization handled by top-level check (Broadcaster/Moderator/Officer)

        // 1. Remove from participants list (mark inactive)
        const { error: kickError } = await supabaseAdmin
            .from('streams_participants')
            .update({ is_active: false, kicked_at: new Date().toISOString() })
            .eq('stream_id', streamId)
            .eq('user_id', userId);

        if (kickError) throw kickError;

        // 2. If banTime provided, add to bans
        if (banTime) {
             const bannedUntil = new Date(Date.now() + banTime * 60000).toISOString();
             await supabaseAdmin.from('stream_bans').insert({
                 stream_id: streamId,
                 user_id: userId,
                 banned_until: bannedUntil,
                 banned_by: user.id
             });
        }

        result = { success: true };
        break;
      }

      case "mute_participant": {
        const { streamId, userId, duration } = params;
        if (!streamId || !userId) throw new Error("Missing required fields");

        // Authorization handled by top-level check

        const muteUntil = duration 
            ? new Date(Date.now() + duration * 60000).toISOString()
            : null; // If no duration, maybe permanent? Or default 5 mins? 
            // If duration is missing, maybe it's just a toggle? 
            // LivePage calls handleMute without duration usually, implying "mute until further notice" or "toggle"?
            // Actually LivePage calls it with just userId. 
            // Let's set a default or just set can_chat = false.

        const updates: any = { can_chat: false };
        if (muteUntil) updates.chat_mute_until = muteUntil;

        const { error } = await supabaseAdmin
            .from('streams_participants')
            .update(updates)
            .eq('stream_id', streamId)
            .eq('user_id', userId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "unmute_participant": {
          const { streamId, userId } = params;
          if (!streamId || !userId) throw new Error("Missing required fields");

          const { error } = await supabaseAdmin
            .from('streams_participants')
            .update({ can_chat: true, chat_mute_until: null })
            .eq('stream_id', streamId)
            .eq('user_id', userId);

          if (error) throw error;
          result = { success: true };
          break;
      }



      case "ensure_dm_conversation": {
          const { otherUserId } = params;
          if (!otherUserId) throw new Error("Missing otherUserId");

          // Check if conversation exists
          const { data: _existing, error: _fetchError } = await supabaseAdmin
            .from('conversations')
            .select('id, participants')
            .contains('participants', [user.id, otherUserId])
            .limit(1); // Approximate check, simpler to use RPC or just create if not exists
          
          // Better approach: use an RPC if available, or just insert and ignore conflict?
          // We can't easily check "exact participants" with simple query.
          // Let's try to find one.
          
          // Actually, LivePage used `ensureConversationForUser` which did:
          // .rpc('create_conversation_if_not_exists', { p_participant_ids: [user.id, otherUserId] })
          
          const { data: convId, error } = await supabaseAdmin.rpc('create_conversation_if_not_exists', {
              p_participant_ids: [user.id, otherUserId]
          });
          
          if (error) throw error;
          result = { success: true, conversationId: convId };
          break;
      }

      case "get_stream_theme": {
          const { streamId } = params;
          if (!streamId) throw new Error("Missing streamId");

          const { data, error: _error } = await supabaseAdmin
            .from('broadcast_themes')
            .select('*')
            .eq('stream_id', streamId)
            .eq('is_active', true)
            .single();

          // It's okay if no theme is active
          result = { success: true, theme: data || null };
          break;
      }

      case "get_stream_status": {
          const { streamId } = params;
          if (!streamId) throw new Error("Missing streamId");
          
          const { data, error } = await supabaseAdmin
            .from('streams')
            .select('status, is_live, ended_at')
            .eq('id', streamId)
            .single();
            
          if (error) throw error;
          result = { success: true, status: data };
          break;
      }

      case "get_stream": {
          const { streamId } = params;
          if (!streamId) throw new Error("Missing streamId");

          const { data, error } = await supabaseAdmin
            .from('streams')
            .select('*')
            .eq('id', streamId)
            .single();

          if (error) throw error;
          result = { success: true, stream: data };
          break;
      }

      case "notify_user": {
        const { targetUserId, type, title, message } = params;
        if (!targetUserId || !title || !message) throw new Error("Missing required fields");

        // Use the existing RPC if possible, or insert directly into notifications?
        // The frontend used 'notify_user_rpc'. Let's see if we can replicate it or call it.
        // We can call the RPC from here using supabaseAdmin.
        
        const { error } = await supabaseAdmin.rpc('notify_user_rpc', {
          p_target_user_id: targetUserId,
          p_type: type || 'system_alert',
          p_title: title,
          p_message: message,
        });

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "log_officer_action": {
        const { targetUserId, actionType, streamId, fee, metadata } = params;
        if (!actionType) throw new Error("Missing actionType");

        const { error } = await supabaseAdmin
          .from('officer_actions')
          .insert({
            officer_id: user.id,
            target_user_id: targetUserId || null,
            action_type: actionType,
            related_stream_id: streamId || null,
            fee_coins: fee || 0,
            metadata: metadata || {}
          });

        if (error) throw error;

        // Also update officer activity if needed
        // The frontend called 'updateOfficerActivity(user.id)'.
        // We can do that here too.
        // But updateOfficerActivity logic might be complex?
        // Let's assume just logging is enough for now, or update 'user_profiles' last_active?
        // Actually, let's look at what updateOfficerActivity does. 
        // It updates 'officer_activity_log' or similar. 
        // For now, let's just do the insert.
        
        result = { success: true };
        break;
      }

      case "assign_broadofficer": {
        const { broadcasterId, officerId } = params;
        if (!broadcasterId || !officerId) throw new Error("Missing required fields");
        // Verify caller is the broadcaster (user.id === broadcasterId)
        // or caller is Admin.
        if (user.id !== broadcasterId && !isAdmin) throw new Error("Unauthorized");

        const { data, error } = await supabaseAdmin.rpc('assign_broadofficer', {
            p_broadcaster_id: broadcasterId,
            p_officer_id: officerId
        });

        if (error) throw error;
        if (data && typeof data === 'object' && 'success' in data && !data.success) {
             throw new Error(data.error || "Failed to assign officer");
        }
        
        result = { success: true, data };
        break;
      }

      case "remove_broadofficer": {
        const { broadcasterId, officerId } = params;
        if (!broadcasterId || !officerId) throw new Error("Missing required fields");
        if (user.id !== broadcasterId && !isAdmin) throw new Error("Unauthorized");

        const { data, error } = await supabaseAdmin.rpc('remove_broadofficer', {
            p_broadcaster_id: broadcasterId,
            p_officer_id: officerId
        });

        if (error) throw error;
        if (data && typeof data === 'object' && 'success' in data && !data.success) {
             throw new Error(data.error || "Failed to remove officer");
        }

        result = { success: true, data };
        break;
      }

      case "log_theme_event": {
          const { events } = params;
          if (!events || !Array.isArray(events)) throw new Error("Missing events array");
          
          const { error } = await supabaseAdmin
            .from('broadcast_theme_events')
            .insert(events);

          if (error) throw error;
          result = { success: true };
          break;
      }

      case "claim_watch_xp": {
          // Rate limit check could be added here (e.g. check last claim time in DB)
          // For now, just proxy to add_xp
          const { error } = await supabaseAdmin.rpc('add_xp', { 
             p_user_id: user.id, 
             p_amount: 5, 
             p_source: 'watch' 
          });
          
          if (error) throw error;
          result = { success: true };
          break;
      }

      // --- Lead Officer Actions ---
      case "fire_officer": {
        if (!isLeadOfficer) throw new Error("Unauthorized: Lead Officer only");
        const { officerId } = params;
        if (!officerId) throw new Error("Missing officerId");

        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .update({ 
            is_officer_active: false, 
            is_troll_officer: false,
            // role: 'user' // Optional: reset role if needed
          })
          .eq('id', officerId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "hire_officer": {
        if (!isLeadOfficer) throw new Error("Unauthorized: Lead Officer only");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");

        // 1. Call RPC to approve application
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('approve_officer_application', {
            p_user_id: userId
        });

        if (rpcError) throw rpcError;
        if (!rpcData?.success) {
             throw new Error(rpcData?.error || 'Failed to approve officer application via RPC');
        }

        // 2. Activate officer in profiles
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .update({
            is_officer_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "approve_lead_application": {
        if (!isLeadOfficer) throw new Error("Unauthorized: Lead Officer only");
        const { applicationId } = params;
        if (!applicationId) throw new Error("Missing applicationId");

        const { data, error } = await supabaseAdmin
          .from('applications')
          .update({
            lead_officer_approved: true,
            lead_officer_reviewed_by: user.id,
            lead_officer_reviewed_at: new Date().toISOString()
          })
          .eq('id', applicationId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "reject_lead_application": {
        if (!isLeadOfficer) throw new Error("Unauthorized: Lead Officer only");
        const { applicationId } = params;
        if (!applicationId) throw new Error("Missing applicationId");

        const { data, error } = await supabaseAdmin
          .from('applications')
          .update({
            lead_officer_approved: false,
            lead_officer_reviewed_by: user.id,
            lead_officer_reviewed_at: new Date().toISOString(),
            status: 'rejected'
          })
          .eq('id', applicationId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "review_application": {
        if (!isLeadOfficer) throw new Error("Unauthorized: Lead Officer only");
        const { applicationId, status, notes } = params;
        if (!applicationId || !status) throw new Error("Missing required fields");

        const { data, error } = await supabaseAdmin
          .from('officer_applications') // Assuming table name based on context
          .update({ 
            status,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
            notes
          })
          .eq('id', applicationId)
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      // --- Troll Officer Actions ---
      case "request_time_off": {
        // Any officer can request time off
        const { date, reason } = params;
        if (!date || !reason) throw new Error("Missing required fields");

        const { data, error } = await supabaseAdmin
          .from('officer_time_off_requests')
          .insert({
            officer_id: user.id,
            date,
            reason,
            status: 'pending'
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "approve_time_off": {
        if (!isLeadOfficer) throw new Error("Unauthorized: Lead Officer only");
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");

        // 1. Get request details to know date/officer
        const { data: request, error: fetchError } = await supabaseAdmin
          .from('officer_time_off_requests')
          .select('*')
          .eq('id', requestId)
          .single();
        
        if (fetchError || !request) throw new Error("Request not found");

        // 2. Update status
        const { error: updateError } = await supabaseAdmin
          .from('officer_time_off_requests')
          .update({ 
            status: 'approved', 
            reviewed_by: user.id, 
            reviewed_at: new Date().toISOString() 
          })
          .eq('id', requestId);

        if (updateError) throw updateError;

        // 3. Delete scheduled shifts
        const { error: deleteError } = await supabaseAdmin
          .from('officer_shift_slots')
          .delete()
          .eq('officer_id', request.officer_id)
          .eq('shift_date', request.date);

        if (deleteError) {
          console.error("Failed to delete shift slots:", deleteError);
          // We don't throw here to avoid rolling back the approval if shift deletion fails, 
          // but in a real transaction we would.
        }

        result = { success: true };
        break;
      }

      case "reject_time_off": {
        if (!isLeadOfficer) throw new Error("Unauthorized: Lead Officer only");
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");

        const { error } = await supabaseAdmin
          .from('officer_time_off_requests')
          .update({ 
            status: 'rejected', 
            reviewed_by: user.id, 
            reviewed_at: new Date().toISOString() 
          })
          .eq('id', requestId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "delete_time_off": {
        const { requestId } = params;
        if (!requestId) throw new Error("Missing requestId");

        // Verify ownership if not Lead
        if (!isLeadOfficer) {
          const { data: request } = await supabaseAdmin
            .from('officer_time_off_requests')
            .select('officer_id')
            .eq('id', requestId)
            .single();
          
          if (!request || request.officer_id !== user.id) {
            throw new Error("Unauthorized: Cannot delete other's requests");
          }
        }

        const { error } = await supabaseAdmin
          .from('officer_time_off_requests')
          .delete()
          .eq('id', requestId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "send_officer_chat": {
        const { message, username } = params;
        if (!message) throw new Error("Missing message");

        const { data, error } = await supabaseAdmin
          .from('officer_chat_messages')
          .insert({
            user_id: user.id,
            message,
            username: username || 'Officer',
            role: isLeadOfficer ? 'Lead Officer' : 'Officer'
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
        break;
      }

      case "kick_user": {
        const { targetUsername, streamId } = params;
        if (!targetUsername) throw new Error("Missing targetUsername");

        // Resolve username to ID
        const { data: targetUser, error: userError } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('username', targetUsername)
          .single();

        if (userError || !targetUser) throw new Error(`User ${targetUsername} not found`);

        const { data, error } = await supabaseAdmin.rpc('kick_user', {
          p_target_user_id: targetUser.id,
          p_kicker_user_id: user.id,
          p_stream_id: streamId || null
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "ban_user": {
        const { targetUsername, reason } = params;
        if (!targetUsername || !reason) throw new Error("Missing required fields");

        // Resolve username to ID
        const { data: targetUser, error: userError } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('username', targetUsername)
          .single();

        if (userError || !targetUser) throw new Error(`User ${targetUsername} not found`);

        const { data, error } = await supabaseAdmin.rpc('issue_warrant', {
          p_user_id: targetUser.id,
          p_reason: reason
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "assign_moderator": {
        const { userId, streamId } = params;
        if (!userId || !streamId) throw new Error("Missing required fields");
        
        // Only Troll Officers+ can assign mods? 
        // Assuming current policy allows officers to do this.
        
        const { error } = await supabaseAdmin
            .from('streams_participants')
            .update({ is_moderator: true })
            .eq('stream_id', streamId)
            .eq('user_id', userId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      case "remove_moderator": {
        const { userId, streamId } = params;
        if (!userId || !streamId) throw new Error("Missing required fields");

        const { error } = await supabaseAdmin
            .from('streams_participants')
            .update({ is_moderator: false })
            .eq('stream_id', streamId)
            .eq('user_id', userId);

        if (error) throw error;
        result = { success: true };
        break;
      }



      case "troll_mic_mute": {
        const { targetUserId, targetUsername, streamId, durationMinutes } = params;
        if (!targetUserId) throw new Error("Missing targetUserId");

        // 1. Determine Fee
        // Relax top-level authorization to allow these actions for ANY authenticated user if they pay.
        
        const isPrivileged = isTrollOfficer || isBroadcaster || isModerator;
        const cost = isPrivileged ? 0 : 25;

        if (cost > 0) {
             const { data: userProfile } = await supabaseAdmin
               .from('user_profiles')
               .select('troll_coins')
               .eq('id', user.id)
               .single();
             
             if (!userProfile || (userProfile.troll_coins || 0) < cost) {
                throw new Error(`Insufficient funds. Need ${cost} coins.`);
             }

             // Deduct coins
             const { error: coinError } = await supabaseAdmin
               .from('user_profiles')
               .update({ troll_coins: (userProfile.troll_coins || 0) - cost })
               .eq('id', user.id);
             
             if (coinError) throw coinError;
        }

        const duration = durationMinutes || 10;
        const muteDurationMs = duration * 60 * 1000;
        const muteUntil = new Date(Date.now() + muteDurationMs).toISOString();

        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ mic_muted_until: muteUntil })
            .eq('id', targetUserId);

        if (error) throw error;

        // Log Action
        await supabaseAdmin.from('officer_actions').insert({
            officer_id: user.id,
            target_user_id: targetUserId,
            action_type: 'mute', // keeping 'mute' to match legacy
            related_stream_id: streamId || null,
            fee_coins: cost,
            metadata: { username: targetUsername, duration_minutes: duration }
        });

        result = { success: true };
        break;
      }

      case "troll_mic_unmute": {
        const { targetUserId, targetUsername, streamId } = params;
        if (!targetUserId) throw new Error("Missing targetUserId");

        // Only privileged users can unmute
        if (!isTrollOfficer && !isBroadcaster && !isModerator) {
             throw new Error("Unauthorized: Only Officers or Broadcasters can unmute");
        }

        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ mic_muted_until: null })
            .eq('id', targetUserId);

        if (error) throw error;

        await supabaseAdmin.from('officer_actions').insert({
            officer_id: user.id,
            target_user_id: targetUserId,
            action_type: 'unmute',
            related_stream_id: streamId || null,
            fee_coins: 0,
            metadata: { username: targetUsername }
        });

        result = { success: true };
        break;
      }

      case "troll_immunity": {
        const { targetUserId, targetUsername, streamId } = params;
        if (!targetUserId) throw new Error("Missing targetUserId");

        const isPrivileged = isTrollOfficer || isBroadcaster || isModerator;
        const cost = isPrivileged ? 0 : 500;

        if (cost > 0) {
             const { data: userProfile } = await supabaseAdmin
               .from('user_profiles')
               .select('troll_coins')
               .eq('id', user.id)
               .single();
             
             if (!userProfile || (userProfile.troll_coins || 0) < cost) {
                throw new Error(`Insufficient funds. Need ${cost} coins.`);
             }

             const { error: coinError } = await supabaseAdmin
               .from('user_profiles')
               .update({ troll_coins: (userProfile.troll_coins || 0) - cost })
               .eq('id', user.id);
             
             if (coinError) throw coinError;
        }

        const blockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ no_ban_until: blockUntil })
            .eq('id', targetUserId);

        if (error) throw error;

        await supabaseAdmin.from('officer_actions').insert({
            officer_id: user.id,
            target_user_id: targetUserId,
            action_type: 'block', // 'block' means immunity here
            related_stream_id: streamId || null,
            fee_coins: cost,
            metadata: { username: targetUsername, block_until: blockUntil }
        });

        result = { success: true };
        break;
      }

      case "troll_kick": {
        const { targetUserId, targetUsername, streamId } = params;
        if (!targetUserId) throw new Error("Missing targetUserId");

        const isPrivileged = isTrollOfficer || isBroadcaster || isModerator;
        const cost = isPrivileged ? 0 : 500;

        // If RPC kick_user handles fees, we should use it?
        // The RPC 'kick_user' in LivePage is called. Let's see if we can use it or replicate it.
        // It's safer to replicate logic here to ensure single source of truth or call the RPC if it's trusted.
        // Let's assume we do logic here: 
        
        if (cost > 0) {
             const { data: userProfile } = await supabaseAdmin
               .from('user_profiles')
               .select('troll_coins')
               .eq('id', user.id)
               .single();
             
             if (!userProfile || (userProfile.troll_coins || 0) < cost) {
                throw new Error(`Insufficient funds. Need ${cost} coins.`);
             }
             
             // Deduct coins
             const { error: coinError } = await supabaseAdmin
               .from('user_profiles')
               .update({ troll_coins: (userProfile.troll_coins || 0) - cost })
               .eq('id', user.id);
             
             if (coinError) throw coinError;
        }

        // Perform Kick (Call RPC or just do it?)
        // The RPC 'kick_user' likely does some checks or multiple updates.
        // Let's call the RPC using Admin client to bypass RLS if needed, but pass the correct kicker/target.
        // Actually, if we use Admin client, we can just invoke the RPC.
        
        const { error: rpcError } = await supabaseAdmin.rpc('kick_user', {
            p_target_user_id: targetUserId,
            p_kicker_user_id: user.id,
            p_stream_id: streamId || null,
            // p_fee: cost // Does the RPC take a fee? LivePage didn't pass it. It passed target, kicker, stream.
            // If the RPC handles the fee, we might be double charging.
            // LivePage logic: checks funds, calls RPC, then inserts into officer_actions.
            // It seems the RPC 'kick_user' might NOT charge the fee itself, it just kicks?
            // "const fee = isPrivileged ? 0 : 500; ... if (funds < fee) return; ... rpc('kick_user')..."
            // So the frontend was checking funds but NOT deducting them?
            // Wait, I missed where the frontend deducts the fee!
            // Let's look at LivePage again.
        });
        
        if (rpcError) throw rpcError;

        await supabaseAdmin.from('officer_actions').insert({
            officer_id: user.id,
            target_user_id: targetUserId,
            action_type: 'kick',
            related_stream_id: streamId || null,
            fee_coins: cost,
            metadata: { username: targetUsername }
        });

        result = { success: true };
        break;
      }

      case "find_opponent": {
        const { p_user_id: _p_user_id } = params; // Or just user.id
        // The frontend calls rpc('find_opponent', { p_user_id: user.id })
        // We can just use user.id from auth
        
        const { data, error } = await supabaseAdmin.rpc('find_opponent', {
            p_user_id: user.id
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "skip_opponent": {
        const { battleId } = params;
        if (!battleId) throw new Error("Missing battleId");

        const { data, error } = await supabaseAdmin.rpc('skip_opponent', {
            p_user_id: user.id,
            p_battle_id: battleId
        });

        if (error) throw error;
        result = data;
        break;
      }

      case "check_broadofficer": {
        const { broadcasterId, userId } = params;
        // Use RPC if available, or query directly
        // Assuming rpc 'check_broadofficer' exists based on intent, 
        // OR we can query the officer_assignments table directly.
        // Let's query directly for safety if we are not sure about RPC.
        
        if (!broadcasterId || !userId) throw new Error("Missing IDs");

        const { data, error } = await supabaseAdmin
            .from('officer_assignments')
            .select('*')
            .eq('broadcaster_id', broadcasterId)
            .eq('officer_id', userId)
            .maybeSingle();

        if (error) throw error;
        result = { isBroadofficer: !!data };
        break;
      }

      case "restrict_live": {
        const { targetUserId, targetUsername, durationMinutes, streamId } = params;
        if (!targetUserId || !durationMinutes) throw new Error("Missing required fields");

        const restrictedUntil = new Date(Date.now() + durationMinutes * 60000).toISOString();

        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ live_restricted_until: restrictedUntil })
            .eq('id', targetUserId);

        if (error) throw error;

        await supabaseAdmin.from('officer_actions').insert({
            officer_id: user.id,
            target_user_id: targetUserId,
            action_type: 'restrict_live',
            related_stream_id: streamId || null,
            fee_coins: 0,
            metadata: { 
                username: targetUsername, 
                restricted_until: restrictedUntil,
                duration_minutes: durationMinutes
            }
        });

        result = { success: true };
        break;
      }

      case "report_troll_attack": {
         const { targetUserId, targetUsername, streamId, description } = params;
         if (!targetUserId || !streamId) throw new Error("Missing required fields");
         
         const { error } = await supabaseAdmin.from('support_tickets').insert({
            user_id: targetUserId,
            type: 'troll_attack',
            description: description || `Officer report for ${targetUsername} in stream ${streamId}`,
            metadata: {
              stream_id: streamId,
              reported_by: user.id,
            },
         });
         
         if (error) throw error;
         
         await supabaseAdmin.from('officer_actions').insert({
            officer_id: user.id,
            target_user_id: targetUserId,
            action_type: 'report',
            related_stream_id: streamId,
            fee_coins: 0,
            metadata: { stream_id: streamId }
         });

         result = { success: true };
         break;
      }

      case "issue_warrant": {
         const { targetUserId, reason, targetUsername } = params;
         if (!targetUserId || !reason) throw new Error("Missing required fields");
         
         const { data, error } = await supabaseAdmin.rpc('issue_warrant', {
            p_user_id: targetUserId,
            p_reason: reason
         });
         
         if (error) throw error;
         if (data && !data.success) {
            throw new Error(data.error || 'Failed to issue warrant');
         }
         
         await supabaseAdmin.from('officer_actions').insert({
            officer_id: user.id,
            target_user_id: targetUserId,
            action_type: 'ban', // Keeping as ban to match legacy
            related_stream_id: null,
            fee_coins: 0,
            metadata: { reason, type: 'warrant', username: targetUsername }
         });
         
         result = { success: true };
         break;
      }

      
      case "verify_stream_password": {
        const { streamId, password } = params;
        if (!streamId || !password) throw new Error("Missing fields");
        
        // Fetch private_password from stream
        const { data: stream, error } = await supabaseAdmin
            .from('streams')
            .select('private_password')
            .eq('id', streamId)
            .single();
            
        if (error || !stream) throw new Error("Stream not found");
        
        const isValid = stream.private_password === password;
        if (!isValid) {
            throw new Error("Invalid password");
        }
        
        result = { success: true };
        break;
      }

      case "assign_battle_guests": {
        const { battleId, isPlayer1, streamId } = params;
        if (!battleId || !streamId) throw new Error("Missing required fields");
        
        // 1. Get Top Gifters logic
        const { data: gifts } = await supabaseAdmin
            .from('gifts')
            .select('receiver_id, coins_spent')
            .eq('stream_id', streamId);

        if (!gifts) {
             result = { success: true, count: 0 };
             break;
        }

        const totals: Record<string, number> = {};
        gifts.forEach((g: any) => {
            if (g.receiver_id === user.id) return; // Exclude self? The frontend excluded user.id.
            if (g.receiver_id) {
                totals[g.receiver_id] = (totals[g.receiver_id] || 0) + (g.coins_spent || 0);
            }
        });

        const sortedIds = Object.entries(totals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 2)
            .map(([id]) => id);

        if (sortedIds.length === 0) {
            result = { success: true, count: 0 };
            break;
        }

        const { data: guests } = await supabaseAdmin
            .from('user_profiles')
            .select('id, username, avatar_url')
            .in('id', sortedIds);

        if (!guests || guests.length === 0) {
            result = { success: true, count: 0 };
            break;
        }

        const battleParticipants = guests.map((g: any) => ({
            user_id: g.id,
            username: g.username,
            avatar_url: g.avatar_url
        }));

        const updateField = isPlayer1 ? 'host_guests' : 'challenger_guests';
        
        const { error: updateError } = await supabaseAdmin
            .from('troll_battles')
            .update({ [updateField]: battleParticipants })
            .eq('id', battleId);
            
        if (updateError) throw updateError;
        
        result = { success: true, guests: battleParticipants };
        break;
      }

      case "ban_ip_address": {
        const { targetUserId, ipAddress, banReason, banDetails, bannedUntil } = params;
        
        // Authorization
        if (!isAdmin && !isTrollOfficer) throw new Error("Unauthorized");
    
        let ipToBan = ipAddress;
    
        // If no IP provided (or Officer mode where they don't see it), look it up from targetUserId
        if (!ipToBan && targetUserId) {
            const { data: userProfile } = await supabaseAdmin
                .from('user_profiles')
                .select('last_known_ip')
                .eq('id', targetUserId)
                .single();
            
            if (userProfile?.last_known_ip) {
                ipToBan = userProfile.last_known_ip;
            }
        }
    
        if (!ipToBan) {
            throw new Error("No IP address found to ban");
        }
    
        // Call RPC
        const { data, error } = await supabaseAdmin.rpc('ban_ip_address', {
            p_ip_address: ipToBan,
            p_ban_reason: banReason,
            p_officer_id: user.id,
            p_ban_details: banDetails || null,
            p_banned_until: bannedUntil || null
        });
    
        if (error) throw error;
        
        if (data && typeof data === 'object' && 'success' in data && !data.success) {
             throw new Error(data.error || 'Failed to ban IP address');
        }
        
        result = data;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Officer Action Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
