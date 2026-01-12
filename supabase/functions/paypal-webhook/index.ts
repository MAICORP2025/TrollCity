import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const config = { runtime: "edge" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") ?? "live";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Content-Type": "application/json",
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
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
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
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: cors,
    });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    const text = await req.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  console.log("PayPal webhook event:", body);

  try {
    const eventType = body?.event_type || body?.eventType;

    if (!eventType) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: cors,
      });
    }

    if (eventType === "CHECKOUT.ORDER.APPROVED") {
      return new Response(JSON.stringify({ ok: true, handled: "approved" }), {
        status: 200,
        headers: cors,
      });
    }

    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const resource = body?.resource || {};
      const captureId: string | undefined = resource?.id;

      if (!captureId) {
        return new Response(
          JSON.stringify({ ok: true, message: "Missing capture id" }),
          { status: 200, headers: cors },
        );
      }

      const { data: existingTx } = await supabase
        .from("coin_transactions")
        .select("id")
        .eq("external_id", captureId)
        .maybeSingle();

      if (existingTx) {
        return new Response(
          JSON.stringify({
            ok: true,
            handled: "duplicate",
            captureId,
          }),
          { status: 200, headers: cors },
        );
      }

      let orderId: string | undefined =
        resource?.supplementary_data?.related_ids?.order_id;

      if (!orderId) {
        const upLink = Array.isArray(resource?.links)
          ? resource.links.find((l: any) => l?.rel === "up")
          : undefined;
        if (upLink?.href && typeof upLink.href === "string") {
          orderId = upLink.href.split("/").pop();
        }
      }

      if (!orderId) {
        console.warn("Webhook capture missing order_id; skipping credit", {
          captureId,
        });
        return new Response(
          JSON.stringify({ ok: true, message: "No order_id" }),
          { status: 200, headers: cors },
        );
      }

      const accessToken = await getAccessToken();
      const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!orderRes.ok) {
        const txt = await orderRes.text();
        console.error("PayPal get order error", txt);
        return new Response(JSON.stringify({ ok: true, error: "order_fetch_failed" }), {
          status: 200,
          headers: cors,
        });
      }

      const orderData = await orderRes.json();
      const purchaseUnit = orderData?.purchase_units?.[0];
      const customId: string | undefined = purchaseUnit?.custom_id;

      if (!customId) {
        return new Response(
          JSON.stringify({ ok: true, message: "Missing custom_id" }),
          { status: 200, headers: cors },
        );
      }

      let metaUserId: string | undefined;
      let metaCoins: number | undefined;

      if (customId.includes("|")) {
        const [uid, coinsStr] = customId.split("|");
        metaUserId = uid;
        metaCoins = parseInt(coinsStr, 10);
      } else {
        try {
          const jsonMeta = JSON.parse(customId);
          metaUserId = jsonMeta.userId || jsonMeta.user_id;
          metaCoins = Number(jsonMeta.coins);
        } catch {
          console.error("Invalid custom_id format", customId);
        }
      }

      if (!metaUserId || !metaCoins || Number.isNaN(metaCoins)) {
        return new Response(
          JSON.stringify({ ok: true, message: "Invalid metadata" }),
          { status: 200, headers: cors },
        );
      }

      const usdAmount = Number(
        resource?.amount?.value ??
          purchaseUnit?.amount?.value ??
          0,
      );

      const { error: txErr } = await supabase.from("coin_transactions").insert({
        user_id: metaUserId,
        amount: metaCoins,
        type: "purchase",
        description: `PayPal Purchase ${orderId}`,
        source: "paypal_webhook",
        external_id: captureId,
        paypal_order_id: orderId,
        platform_profit: usdAmount,
        coin_type: "paid",
        status: "completed",
        metadata: {
          event_type: eventType,
          payment_status: resource?.status,
        },
      });

      if (txErr) {
        console.error("Insert transaction error", txErr);
        return new Response(JSON.stringify({ ok: true, error: "tx_insert_failed" }), {
          status: 200,
          headers: cors,
        });
      }

      let rpcError: any = null;
      try {
        const { error } = await supabase.rpc("add_troll_coins", {
          user_id_input: metaUserId,
          coins_to_add: metaCoins,
        });
        rpcError = error || null;
      } catch (e) {
        rpcError = e;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("troll_coins")
        .eq("id", metaUserId)
        .single();
      const currentPaid = profile?.troll_coins || 0;

      if (currentPaid < metaCoins) {
        const { error: balErr } = await supabase
          .from("user_profiles")
          .update({ troll_coins: currentPaid + metaCoins })
          .eq("id", metaUserId);
        if (balErr) {
          console.error("Manual balance update error", balErr, rpcError);
        }
      }

      try {
        await supabase.rpc("mark_user_paid", { p_user_id: metaUserId });
      } catch (markErr) {
        console.warn("mark_user_paid failed:", markErr);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          handled: "capture_completed",
          coinsAdded: metaCoins,
          captureId,
          orderId,
        }),
        { status: 200, headers: cors },
      );
    }

    // Default: acknowledge unknown events to avoid retries
    return new Response(JSON.stringify({ ok: true, handled: "ignored" }), {
      status: 200,
      headers: cors,
    });
  } catch (e: any) {
    console.error("Webhook processing error:", e);
    return new Response(JSON.stringify({ ok: true, error: "unhandled" }), {
      status: 200,
      headers: cors,
    });
  }
});
