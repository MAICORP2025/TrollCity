import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { fulfillPaypalCoinStorePurchase } from "../_shared/paypalStoreFulfillment.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Rate Limit Check
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  // Use anon key for rate limiting if preferred, but service role works too. 
  // Just reusing existing client.
  const { data: allowed, error: rateError } = await supabase.rpc('check_rate_limit', {
    p_key: `paypal_complete_${ip}`,
    p_limit: 10, // 10 attempts per minute
    p_window_seconds: 60
  });

  if (rateError) console.error('Rate limit error:', rateError);
  if (!allowed) {
    return new Response(
      JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const orderId: string | undefined = body?.orderId ?? body?.orderID;
    const userId: string | undefined = body?.userId ?? body?.user_id;
    const packageId: string | undefined = body?.packageId ?? body?.package_id;

    if (!orderId || !userId) {
      throw new Error("Missing required fields: orderId and userId");
    }

    // 0. Check if order already processed
    const { data: existingTx } = await supabase
      .from("paypal_transactions")
      .select("*")
      .eq("paypal_order_id", orderId)
      .maybeSingle();

    if (existingTx && existingTx.status === "credited") {
      return new Response(JSON.stringify({
        success: true,
        coinsAdded: existingTx.coins,
        alreadyProcessed: true,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Verify and capture payment with PayPal (or Mock)
    let verifiedAmount = 0;
    let verifiedCurrency = "USD";
    let captureId: string | null = null;
    let status = "";
    let completed = false;
    let orderData: any = null;

    // SIMULATION MODE
    if (body.simulation_mode === true) {
      const simSecret = req.headers.get('x-simulation-secret') || body.simulation_secret;
      // Simple check to prevent public abuse
      if (simSecret !== "SIMULATION_TEST_2025") { 
           console.warn("Simulation attempt with invalid secret");
      } else {
           console.log("SIMULATION MODE ACTIVE");
           verifiedAmount = body.mock_amount || 1.99;
           verifiedCurrency = "USD";
           captureId = "SIM_" + Math.random().toString(36).substring(7);
           status = "COMPLETED";
           completed = true;
      }
    }

    if (!completed) {
        const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
        const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
        const isSandbox = Deno.env.get("PAYPAL_MODE") === "sandbox";
        const baseUrl = isSandbox
          ? "https://api-m.sandbox.paypal.com"
          : "https://api-m.paypal.com";

        if (!clientId || !clientSecret) {
          throw new Error("PayPal credentials not configured");
        }

        const auth = btoa(`${clientId}:${clientSecret}`);

        const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "grant_type=client_credentials",
        });

        if (!tokenRes.ok) {
          const text = await tokenRes.text();
          console.error("PayPal token error:", text);
          throw new Error("Failed to authenticate with PayPal");
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token as string;

        // Fetch order first
        const orderRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        });
        if (!orderRes.ok) {
          const text = await orderRes.text();
          console.error("PayPal get order error:", text);
          throw new Error("Failed to fetch PayPal order");
        }

        orderData = await orderRes.json();
        status = orderData?.status ?? "";

        // Capture only if approved
        if (status === "APPROVED") {
          const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          });

          if (!captureRes.ok) {
            const text = await captureRes.text();
            console.error("PayPal capture error:", text);

            let errorMessage = "Failed to capture PayPal order";
            try {
              const jsonError = JSON.parse(text);
              const details = jsonError.details?.[0];
              if (details?.issue === "INSTRUMENT_DECLINED") {
                errorMessage = "Payment declined by bank. Please check your funds or try another card.";
              } else if (jsonError.name === "UNPROCESSABLE_ENTITY") {
                errorMessage = "Payment could not be processed. Please try again.";
              }
            } catch {
              // Keep default error
            }

            return new Response(JSON.stringify({
              success: false,
              error: errorMessage,
              paypal_details: text,
              orderId,
              mode: Deno.env.get("PAYPAL_MODE"),
            }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
          }

          orderData = await captureRes.json();
          status = orderData?.status ?? "";
        }

        // Accept already completed
        completed =
          status === "COMPLETED" ||
          orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.status === "COMPLETED";

        if (!completed) {
          throw new Error(`Payment not completed (status: ${status || "unknown"})`);
        }

        const capture =
          orderData?.purchase_units?.[0]?.payments?.captures?.[0] ?? null;

        captureId = capture?.id ?? null;

        const amountValueString: string =
          capture?.amount?.value ??
          orderData?.purchase_units?.[0]?.amount?.value ??
          "0";

        verifiedAmount = parseFloat(amountValueString || "0");
        verifiedCurrency =
          capture?.amount?.currency_code ??
          orderData?.purchase_units?.[0]?.amount?.currency_code ??
          "USD";
    }

    const fulfill = await fulfillPaypalCoinStorePurchase(supabase, {
      userId,
      orderId,
      captureId,
      verifiedAmount,
      verifiedCurrency,
      packageId,
      status,
    });

    if (!fulfill.success) {
      throw new Error(fulfill.error);
    }

    const responseBody = {
      success: true,
      coinsAdded: fulfill.coinsAdded,
      repay: fulfill.repay ?? 0,
      newLoanBalance: fulfill.newLoanBalance,
      loanStatus: fulfill.loanStatus,
      alreadyProcessed: fulfill.alreadyProcessed,
      message: fulfill.alreadyProcessed ? "Transaction already recorded" : undefined,
      paypal: {
        orderId,
        captureId,
        amount: verifiedAmount,
        currency: verifiedCurrency,
        status,
      },
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("paypal-complete-order error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

