import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID");
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET");
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") ?? "live";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    console.error("PayPal token error", await res.text());
    throw new Error("Failed to get PayPal token");
  }
  const data = await res.json();
  return data.access_token as string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }

  try {
    const { orderID, user_id } = await req.json();

    if (!orderID || !user_id) {
      return new Response(JSON.stringify({ error: "Missing orderID or user_id" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    // 1. Get PayPal Access Token
    const accessToken = await getAccessToken();

    // 2. Capture the Order
    console.log(`Capturing order ${orderID}...`);
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    let captureData;
    if (captureRes.ok) {
        captureData = await captureRes.json();
    } else {
        const errorText = await captureRes.text();
        console.error("PayPal capture error:", errorText);
        // If it's already captured, we might still want to proceed if we can verify details, 
        // but usually we should fail or check status.
        // Let's try to get details if capture failed (maybe it was already captured?)
        if (captureRes.status === 422) { // UNPROCESSABLE_ENTITY (e.g. ORDER_ALREADY_CAPTURED)
             console.log("Order might be already captured, fetching details...");
             const detailsRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderID}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
             });
             if (detailsRes.ok) {
                 captureData = await detailsRes.json();
             } else {
                 throw new Error(`Failed to capture and failed to get details: ${errorText}`);
             }
        } else {
            throw new Error(`Failed to capture order: ${errorText}`);
        }
    }

    if (captureData.status !== "COMPLETED") {
        return new Response(JSON.stringify({ error: "Order not completed", status: captureData.status }), {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" }
        });
    }

    // 3. Verify Custom ID
    const purchaseUnit = captureData.purchase_units?.[0];
    const customIdRaw = purchaseUnit?.custom_id;
    
    if (!customIdRaw) {
        throw new Error("No custom_id found in PayPal order");
    }

    let customData;
    try {
        customData = JSON.parse(customIdRaw);
    } catch (e) {
        console.error("Failed to parse custom_id:", customIdRaw);
        // Fallback for old format if any: uid:123|...
        // But we are focusing on the new JSON format from paypal-create-order
        throw new Error("Invalid custom_id format");
    }

    if (customData.userId !== user_id) {
        return new Response(JSON.stringify({ error: "User ID mismatch" }), {
            status: 403,
            headers: { ...cors, "Content-Type": "application/json" }
        });
    }

    const coinsToAdd = parseInt(customData.coins, 10);
    if (isNaN(coinsToAdd) || coinsToAdd <= 0) {
        throw new Error("Invalid coin amount in custom_id");
    }

    // 4. Initialize Supabase Admin Client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 5. Add Coins (Idempotency check could be here, but we rely on PayPal orderID uniqueness if we log it)
    // Check if we already processed this orderID
    const { data: existingTx } = await supabase
        .from("coin_transactions")
        .select("id")
        .eq("metadata->>paypal_order_id", orderID)
        .single();

    if (existingTx) {
        console.log(`Order ${orderID} already processed.`);
        return new Response(JSON.stringify({ success: true, message: "Already processed", coins_added: coinsToAdd }), {
            status: 200,
            headers: { ...cors, "Content-Type": "application/json" }
        });
    }

    // Award coins
    const { error: rpcError } = await supabase.rpc("add_troll_coins", {
        user_id_input: user_id,
        coins_to_add: coinsToAdd
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        throw new Error("Failed to add coins to user account");
    }

    // 6. Log Transaction
    const { error: logError } = await supabase.from("coin_transactions").insert({
        user_id: user_id,
        type: "store_purchase",
        amount: coinsToAdd,
        coin_type: "troll_coins", // or 'paid' depending on schema, user seems to use 'troll_coins' recently
        description: `PayPal Purchase: ${customData.type || 'coins'}`,
        metadata: {
            paypal_order_id: orderID,
            package_id: customData.packageId,
            paypal_capture_id: captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id,
            raw_custom_id: customData
        }
    });

    if (logError) {
        console.error("Failed to log transaction:", logError);
        // We don't fail the request since coins were added, but we log the error
    }

    return new Response(JSON.stringify({ success: true, coins_added: coinsToAdd }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Verify Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
