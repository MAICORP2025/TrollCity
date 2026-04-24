case "create_marketing_user": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { email, username, fullName } = params;
        if (!email || !username) throw new Error("Missing email or username");
        if (!email.includes('@')) throw new Error("Invalid email format");
        const password = params.password || (function() { var chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*"; var pwd = ""; for (var i = 0; i < 16; i++) { pwd += chars[Math.floor(Math.random() * chars.length)]; } return pwd; })();
        var newUser = await supabaseAdmin.auth.admin.createUser({ email: email, password: password, email_confirm: true, user_metadata: { username: username, full_name: fullName || username } });
        if (newUser.error) throw newUser.error;
        if (!newUser.data.user) throw new Error("Failed to create user");
        var newUserId = newUser.data.user.id;
        var profileError = await supabaseAdmin.from("user_profiles").insert({ id: newUserId, username: username, role: "marketing_readonly", bio: "Marketing Agency Read-Only Account", created_at: new Date().toISOString(), is_broadcaster: true, is_creator_onboarded: false, troll_coins: 0, total_earned_coins: 0, total_spent_coins: 0, tier: 'Bronze' });
        if (profileError.error) { await supabaseAdmin.auth.admin.deleteUser(newUserId); throw profileError.error; }
        await supabaseAdmin.rpc("log_admin_action", { p_action_type: "create_marketing_user", p_target_id: newUserId, p_details: { email: email, username: username, created_by: user.id } });
        result = { success: true, userId: newUserId, email: email, password: password };
        break;
      }

      case "delete_marketing_user": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        const { userId } = params;
        if (!userId) throw new Error("Missing userId");
        var targetProfile = await supabaseAdmin.from("user_profiles").select("role, username").eq("id", userId).single();
        if (targetProfile.error) throw targetProfile.error;
        if (targetProfile.data.role !== "marketing_readonly") throw new Error("User is not a marketing_readonly account");
        var roleError = await supabaseAdmin.rpc('set_user_role', { target_user: userId, new_role: 'user', reason: "Removed by admin " + user.id, acting_admin_id: user.id });
        if (roleError.error) throw roleError.error;
        var disableError = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "forever" });
        if (disableError.error) console.error("Warning: Failed to ban user:", disableError.error);
        await supabaseAdmin.rpc("log_admin_action", { p_action_type: "delete_marketing_user", p_target_id: userId, p_details: { username: targetProfile.data.username, deleted_by: user.id } });
        result = { success: true };
        break;
      }

      case "get_marketing_users": {
        if (!isAdmin) throw new Error("Unauthorized: Admin only");
        var marketingUsers = await supabaseAdmin.from("user_profiles").select("id, username, email, created_at, last_active").eq("role", "marketing_readonly").order("created_at", { ascending: false });
        if (marketingUsers.error) throw marketingUsers.error;
        result = { users: marketingUsers.data || [] };
        break;
      }