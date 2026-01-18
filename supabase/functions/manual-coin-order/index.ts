import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_KEY = Deno.env.get("MANUAL_ORDERS_ADMIN_KEY") || "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalizeCashtag = (raw: string | undefined | null) => {
  const trimmed = (raw ?? "").trim();
  const withoutDollar = trimmed.replace(/^\$+/, "");
  if (!withoutDollar) return { tag: null, error: null };
  if (!/^[A-Za-z0-9._-]{1,30}$/.test(withoutDollar)) {
    return { tag: null, error: "Cash App tag must be 1-30 letters/numbers (no $)." };
  }
  return { tag: withoutDollar };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return new Response(JSON.stringify({ error: "Missing auth token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const action = body?.action as string | undefined;

    if (!action) return new Response(JSON.stringify({ error: "Missing action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    if (action === "create") {
      const pkg = body?.package;
      const coins = Number(body?.coins ?? pkg?.coins);
      const amountUsd = Number(body?.amount_usd ?? pkg?.price_usd);
      const packageId = body?.package_id ?? pkg?.id ?? null;
      const { tag: payerCashtag, error: tagError } = normalizeCashtag(body?.cashapp_tag ?? body?.cash_app_tag ?? body?.payer_cashtag);
      if (tagError) {
        return new Response(JSON.stringify({ error: tagError }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!coins || !amountUsd) {
        return new Response(JSON.stringify({ error: "Missing coins or amount" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      // Verify user profile exists (user_id in manual_coin_orders references user_profiles.id)
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("id, username")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !userProfile) {
        return new Response(JSON.stringify({ error: "User profile not found" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const amount_cents = Math.round(amountUsd * 100);
      const username = body?.username ?? userProfile.username ?? authData.user.user_metadata?.username ?? authData.user.email?.split("@")[0] ?? "user";
      const email = authData.user.email || "";
      const usernamePrefix = String(username).slice(0, 6).toUpperCase();
      const noteSuggested = `${usernamePrefix}-${coins}`;

      const { data: order, error } = await supabaseAdmin
        .from("manual_coin_orders")
        .insert({
          user_id: authData.user.id,
          package_id: packageId,
          coins,
          amount_cents,
          note_suggested: noteSuggested,
          payer_cashtag: payerCashtag || "unknown",
          metadata: {
            username,
            email,
            package_name: pkg?.name,
            purchase_type: body?.purchase_type ?? null,
            payer_cashtag: payerCashtag || "unknown",
          },
        })
        .select("id, status, coins, amount_cents, note_suggested")
        .single();

      if (error || !order) {
        console.error("manual-coin-order insert error", error);
        return new Response(JSON.stringify({ error: error?.message || "Failed to create manual order" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const instructions = {
        provider: "cashapp",
        cashtag: "$trollcity95",
        payer_cashtag: payerCashtag!,
        note: noteSuggested,
        message: "Send Cash App payment, include note with your username prefix and coins. Coins will be granted after verification.",
      };

      return new Response(JSON.stringify({ success: true, orderId: order.id, instructions }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "approve") {
      const adminKey = req.headers.get("x-admin-key") || "";

      const { data: requesterProfile } = await supabaseAdmin
        .from("user_profiles")
        .select("role, is_admin")
        .eq("id", authData.user.id)
        .single();

      const isPrivileged =
        requesterProfile?.role === "admin" ||
        requesterProfile?.role === "secretary" ||
        requesterProfile?.is_admin === true ||
        (ADMIN_KEY && adminKey === ADMIN_KEY);
      if (!isPrivileged) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const rawOrderId = (body?.order_id as string | undefined)?.trim();
      if (!rawOrderId) {
        return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!/^[0-9a-fA-F-]{36}$/.test(rawOrderId)) {
        return new Response(JSON.stringify({ error: "Invalid order_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      let externalTxId = body?.external_tx_id as string | undefined;
      if (typeof externalTxId === "string") {
        externalTxId = externalTxId.trim();
        if (externalTxId.length === 0) {
          externalTxId = undefined;
        } else if (externalTxId.length > 128) {
          return new Response(JSON.stringify({ error: "external_tx_id too long" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
        }
      } else {
        externalTxId = undefined;
      }

      const { data: manualOrder, error: manualOrderError } = await supabaseAdmin
        .from("manual_coin_orders")
        .select("id, coin_orders_id, status")
        .eq("id", rawOrderId)
        .single();
      if (manualOrderError || !manualOrder) {
        return new Response(JSON.stringify({ error: "manual_order_not_found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!manualOrder.coin_orders_id) {
        return new Response(JSON.stringify({ error: "manual_order_missing_coin_order" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }

      const { data: result, error: rpcError } = await supabaseAdmin.rpc("approve_manual_order", {
        p_order_id: manualOrder.coin_orders_id,
        p_admin_id: authData.user.id,
        p_external_tx_id: externalTxId ?? null,
      });
      if (rpcError) {
        console.error("approve_manual_order RPC error", rpcError);
        return new Response(JSON.stringify({ error: rpcError.message || "Approval failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const row = Array.isArray(result) ? result[0] : result;
      if (!row?.success) {
        return new Response(JSON.stringify({ error: row?.error_message || "Approval failed" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const { error: manualUpdateError } = await supabaseAdmin
        .from("manual_coin_orders")
        .update({
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", manualOrder.id);
      if (manualUpdateError) {
        console.error("Failed to mark manual order approved", manualUpdateError);
      }
      return new Response(JSON.stringify({ success: true, newBalance: row.new_balance }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const orderId = body?.order_id as string | undefined;
      if (!orderId) return new Response(JSON.stringify({ error: "Missing order_id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

      const { data: order, error } = await supabaseAdmin
        .from("manual_coin_orders")
        .select("id, status, coins, amount_cents, paid_at, fulfilled_at, payer_cashtag")
        .eq("id", orderId)
        .single();
      if (error || !order) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, order }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("manual-coin-order error", err);
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
