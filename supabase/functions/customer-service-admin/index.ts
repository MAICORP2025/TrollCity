import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCorsPreflight(req);
  if (corsResponse) return corsResponse;

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return withCors(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401 }
      );
    }

    // Create a client with the caller's auth to verify their identity
    const userSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Get the calling user's profile
    const { data: { user: authUser }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !authUser) {
      return withCors(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401 }
      );
    }

    // Verify admin role (admin or CEO)
    const { data: callerProfile } = await userSupabase
      .from("user_profiles")
      .select("role, is_admin")
      .eq("id", authUser.id)
      .maybeSingle();
    const isAdmin = callerProfile?.is_admin === true ||
      callerProfile?.role === "admin" ||
      callerProfile?.role === "ceo";
    if (!isAdmin) {
      return withCors(
        JSON.stringify({ error: "Forbidden: Admin role required" }),
        { status: 403 }
      );
    }

    // Parse the request body
    const body = await req.json();
    const { action, target_user_id, reason } = body;

    if (!action || !target_user_id) {
      return withCors(
        JSON.stringify({ error: "Missing action or target_user_id" }),
        { status: 400 }
      );
    }

    // Create a service role client for admin operations
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get target user's email
    const { data: targetProfile, error: profileError } = await adminSupabase
      .from("user_profiles")
      .select("id, username, email")
      .eq("id", target_user_id)
      .maybeSingle();

    if (profileError || !targetProfile) {
      return withCors(
        JSON.stringify({ error: "Target user not found" }),
        { status: 404 }
      );
    }

    // Handle different actions
    if (action === "send_password_reset") {
      // Send password reset email via Supabase Auth
      const { error: resetError } = await adminSupabase.auth.resetPasswordForEmail(
        targetProfile.email,
        { redirectTo: `${Deno.env.get("SITE_URL") || ""}/reset-password` }
      );

      if (resetError) {
        return withCors(
          JSON.stringify({ error: `Password reset failed: ${resetError.message}` }),
          { status: 500 }
        );
      }

      // Log to admin_password_resets
      await adminSupabase.from("admin_password_resets").insert({
        target_user_id,
        requested_by: authUser.id,
        reset_method: "email_reset_link",
        reason: reason || null,
      });

      // Audit log
      await adminSupabase.from("customer_service_audit_logs").insert({
        actor_id: authUser.id,
        target_user_id,
        action: "password_reset_sent",
        details: {
          method: "email_reset_link",
          reason: reason || null,
          target_username: targetProfile.username,
        },
      });

      return withCors(
        JSON.stringify({
          success: true,
          message: `Password reset email sent to ${targetProfile.username}`,
        })
      );
    }

    if (action === "force_password_reset") {
      // Generate a recovery session which forces password reset on next login
      const { error: recoveryError } = await adminSupabase.auth.admin.generateLink({
        type: "recovery",
        email: targetProfile.email,
      });

      if (recoveryError) {
        return withCors(
          JSON.stringify({ error: `Force reset failed: ${recoveryError.message}` }),
          { status: 500 }
        );
      }

      // Log to admin_password_resets
      await adminSupabase.from("admin_password_resets").insert({
        target_user_id,
        requested_by: authUser.id,
        reset_method: "force_reset_required",
        reason: reason || null,
      });

      // Audit log
      await adminSupabase.from("customer_service_audit_logs").insert({
        actor_id: authUser.id,
        target_user_id,
        action: "password_reset_forced",
        details: {
          method: "force_reset_required",
          reason: reason || null,
          target_username: targetProfile.username,
        },
      });

      return withCors(
        JSON.stringify({
          success: true,
          message: `Force password reset initiated for ${targetProfile.username}`,
        })
      );
    }

    return withCors(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[customer-service-admin] Error:", err);
    return withCors(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500 }
    );
  }
});
