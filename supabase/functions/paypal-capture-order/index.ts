import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") ?? "live";

// CORS headers - Allow all origins for testing
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

const PAYPAL_BASE =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken() {
  const creds = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("PayPal token error", txt);
    throw new Error(`Failed to get PayPal token: ${txt}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    
    let currentUserId: string | null = null;

    if (token) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (!userErr && userData.user) {
        currentUserId = userData.user.id;
      }
    }

    const body = await req.json();
    // Accept orderId or orderID
    const orderId = (body.orderID || body.orderId) as string;
    
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Missing orderID" }), { status: 400, headers: cors });
    }

    console.log(`PayPal capture: orderID=${orderId}, env=${PAYPAL_MODE}, user=${currentUserId}`);

    const accessToken = await getAccessToken();

    // 1. Get current order status
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!orderRes.ok) {
      const txt = await orderRes.text();
      console.error("PayPal get order error", txt);
      return new Response(JSON.stringify({ error: "Failed to fetch order", details: txt }), { status: 500, headers: cors });
    }

    let orderData = await orderRes.json();

    // 2. Capture if not completed
    if (orderData.status !== "COMPLETED") {
      const captureRes = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          }
        }
      );

      if (!captureRes.ok) {
        const errorText = await captureRes.text();
        console.error("PayPal capture error:", errorText);
        const debugId = captureRes.headers.get('paypal-debug-id') || 'unknown';
        return new Response(JSON.stringify({
          error: "Failed to capture payment",
          paypalDebugId: debugId,
          details: errorText
        }), {
          status: 500,
          headers: cors
        });
      }

      orderData = await captureRes.json();
    }

    const purchaseUnit = orderData.purchase_units?.[0];
    const payments = purchaseUnit?.payments;
    const capture = payments?.captures?.[0];

    if (!capture || capture.status !== "COMPLETED") {
      console.error("Capture not completed", capture);
      return new Response(JSON.stringify({ error: "Payment not completed", status: capture?.status }), { status: 400, headers: cors });
    }

    // 3. Idempotency Check - Check if this capture ID has already been processed
    const { data: existingTx } = await supabase
      .from("ledger_transactions")
      .select("id")
      .eq("unique_reference", capture.id)
      .maybeSingle();

    if (existingTx) {
      console.log("Transaction already processed:", existingTx.id);
      return new Response(
        JSON.stringify({
          success: true,
          message: "Transaction already processed",
          coinsAdded: 0,
          orderId: orderId,
          captureId: capture.id
        }),
        { status: 200, headers: cors }
      );
    }

    // 4. Parse Metadata
    const customId = purchaseUnit.custom_id;
    if (!customId) {
      return new Response(JSON.stringify({ error: "Missing custom_id in PayPal order" }), { status: 400, headers: cors });
    }

    let metaUserId: string;
    let metaCoins: number;
    let metaType: string | null = null;

    if (customId.includes("|")) {
      const [uid, coinsStr] = customId.split("|");
      metaUserId = uid;
      metaCoins = parseInt(coinsStr, 10);
    } else {
      try {
        const jsonMeta = JSON.parse(customId);
        metaUserId = jsonMeta.userId || jsonMeta.user_id;
        metaCoins = Number(jsonMeta.coins);
        metaType = jsonMeta.type || null;
      } catch {
        console.error("Failed to parse custom_id", customId);
        return new Response(JSON.stringify({ error: "Invalid custom_id format" }), { status: 400, headers: cors });
      }
    }

    if (!metaUserId || isNaN(metaCoins)) {
      return new Response(JSON.stringify({ error: "Invalid metadata extracted" }), { status: 400, headers: cors });
    }

    const usdAmount = Number(
      capture.amount?.value ? capture.amount.value : purchaseUnit.amount.value
    );
    const payerEmail =
      capture.seller_receivable_breakdown?.net_amount?.value ??
      orderData.payer?.email_address ??
      null;

    console.log(`Processing purchase: user=${metaUserId}, coins=${metaCoins}, usd=${usdAmount}`);

    // 5. Call RPC to process PayPal capture allocation (splits $1 to admin_spendable, remainder to broadcaster_liability)
    try {
      const { data: ledgerData, error: ledgerError } = await supabase
        .rpc('process_paypal_capture_allocation', {
          p_usd_amount: usdAmount,
          p_coin_amount: metaCoins,
          p_capture_id: capture.id,
          p_paypal_order_id: orderId,
          p_user_id: metaUserId,
          p_metadata: {
            payer_email: payerEmail,
            payment_status: capture.status,
            payment_method: "paypal_web",
            order_status: orderData.status
          }
        });

      if (ledgerError) {
        console.error("Ledger allocation error:", ledgerError);
        // Continue with coin addition even if ledger fails - don't block the purchase
      } else {
        console.log("Ledger allocation successful:", ledgerData);
      }
    } catch (ledgerErr) {
      console.error("Ledger allocation exception:", ledgerErr);
      // Continue with coin addition even if ledger fails
    }

    // 6. Insert Transaction into coin_transactions (existing logic)
    const { error: txErr } = await supabase.from("coin_transactions").insert({
      user_id: metaUserId,
      amount: metaCoins,
      type: "purchase",
      description: `PayPal Purchase ${orderId}`,
      source: "paypal_web",
      external_id: capture.id,
      paypal_order_id: orderId,
      platform_profit: usdAmount,
      coin_type: "paid",
      status: "completed",
      metadata: {
        ...orderData,
        payer_email: payerEmail,
        payment_status: capture.status,
        payment_method: "paypal_web"
      }
    });

    if (txErr) {
      console.error("Insert transaction error", txErr);
      return new Response(JSON.stringify({ error: "Failed to log transaction", details: txErr }), { status: 500, headers: cors });
    }

    // 7. Add Coins and verify final balance
    let rpcErr: any = null;
    try {
      const { error } = await supabase.rpc("add_troll_coins", {
        user_id_input: metaUserId,
        coins_to_add: metaCoins
      });
      rpcErr = error || null;
    } catch (e) {
      rpcErr = e;
    }

    // Always verify the new balance; fix if RPC wrote to wrong column
    const { data: profileAfter } = await supabase
      .from("user_profiles")
      .select("troll_coins")
      .eq("id", metaUserId)
      .single();

    const currentPaid = profileAfter?.troll_coins || 0;
    if (currentPaid < metaCoins && rpcErr) {
      console.error("RPC add_troll_coins error", rpcErr);
    }

    if (currentPaid < metaCoins) {
      // Adjust balance to ensure coins are actually credited
      const { data: profileBefore } = await supabase
        .from("user_profiles")
        .select("troll_coins")
        .eq("id", metaUserId)
        .single();
      const beforePaid = profileBefore?.troll_coins || 0;

      const { error: balErr } = await supabase
        .from("user_profiles")
        .update({ troll_coins: beforePaid + metaCoins })
        .eq("id", metaUserId);

      if (balErr) {
        console.error("Manual balance update error", balErr);
        return new Response(
          JSON.stringify({ error: "Failed to update balance" }),
          { status: 500, headers: cors }
        );
      }
    }

    // 8. Troll Pass activation if applicable
    if (metaType === "troll_pass") {
      const now = new Date();
      const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const nowIso = now.toISOString();
      const { error: passErr } = await supabase
        .from("user_profiles")
        .update({
          troll_pass_expires_at: expires,
          troll_pass_last_purchased_at: nowIso
        })
        .eq("id", metaUserId);
      if (passErr) {
        console.error("Failed to activate Troll Pass", passErr);
      }
    }

    // 9. Record admin spendable allocation for tracking
    const adminAllocation = 1.00;
    console.log(`✅ PayPal transaction complete: $${usdAmount} → $${adminAllocation} admin_spendable, $${usdAmount - adminAllocation} broadcaster_liability`);

    return new Response(
      JSON.stringify({
        success: true,
        coinsAdded: metaCoins,
        orderId: orderId,
        captureId: capture.id,
        usdAmount: usdAmount,
        adminAllocation: adminAllocation,
        broadcasterLiability: usdAmount - adminAllocation
      }),
      { status: 200, headers: cors }
    );
  } catch (e: any) {
    console.error("Server error:", e);
    return new Response(JSON.stringify({ error: "Internal server error", details: e.message }), { status: 500, headers: cors });
  }
});
