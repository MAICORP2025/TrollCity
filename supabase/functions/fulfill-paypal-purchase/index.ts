// @ts-expect-error Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-expect-error Deno import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_MODE = Deno.env.get("PAYPAL_MODE") ?? "live";

const PAYPAL_BASE = PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

// CORS headers
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

// Types
interface PayPalTokenResponse {
  access_token: string;
}

interface PayPalOrderResponse {
  status: string;
  intent?: string;
  payer?: {
    email_address?: string;
  };
  purchase_units?: Array<{
    custom_id?: string;
    amount?: {
      value: string;
      currency_code?: string;
    };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: {
          value: string;
          currency_code?: string;
        };
        seller_receivable_breakdown?: {
          net_amount?: { value: string };
          platform_fees?: Array<{ amount?: { value: string } }>;
        };
      }>;
    };
  }>;
}

interface FulfillRequest {
  orderId: string;
  packageId?: string;
  userId?: string;
  captureResponse?: Record<string, unknown>;
}

interface FulfillResponse {
  success: boolean;
  orderId: string;
  captureId?: string;
  coinsAdded?: number;
  usdAmount?: number;
  error?: string;
  errorCode?: string;
  requiresManualIntervention?: boolean;
}

// Helper: Get PayPal access token
async function getPayPalAccessToken(): Promise<string> {
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
    throw new Error(`PayPal token error: ${txt}`);
  }
  
  const data: PayPalTokenResponse = await res.json() as PayPalTokenResponse;
  return data.access_token;
}

// Helper: Fetch PayPal order details
async function getPayPalOrder(orderId: string, accessToken: string): Promise<PayPalOrderResponse> {
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to fetch PayPal order: ${txt}`);
  }
  
  return res.json() as Promise<PayPalOrderResponse>;
}

// Helper: Parse custom_id from PayPal order
function parseCustomId(customId: string | undefined): {
  userId: string | null;
  packageId: string | null;
  coins: number | null;
  type: string | null;
} {
  if (!customId) {
    return { userId: null, packageId: null, coins: null, type: null };
  }
  
  try {
    // Try JSON format first
    const jsonMeta = JSON.parse(customId);
    return {
      userId: jsonMeta.userId || jsonMeta.user_id || null,
      packageId: jsonMeta.packageId || jsonMeta.package_id || null,
      coins: Number(jsonMeta.coins) || null,
      type: jsonMeta.type || null
    };
  } catch {
    // Try pipe-separated format: uid:xxx|pkg:xxx|coins:xxx
    if (customId.includes("|")) {
      const parts = customId.split("|");
      const result: Record<string, string> = {};
      for (const part of parts) {
        const [key, value] = part.split(":");
        if (key && value) {
          result[key.trim()] = value.trim();
        }
      }
      return {
        userId: result.uid || null,
        packageId: result.pkg || null,
        coins: Number(result.coins) || null,
        type: result.type || null
      };
    }
  }
  
  return { userId: null, packageId: null, coins: null, type: null };
}

// Helper: Record payment log with error
async function recordPaymentLog(
  supabase: any,
  logData: {
    paypal_order_id: string;
    paypal_capture_id?: string;
    user_id?: string;
    package_id?: string;
    status: string;
    amount_usd: number;
    coins_granted?: number;
    error_code?: string;
    error_message?: string;
    raw_response?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase
    .from("payment_logs")
    .upsert({
      paypal_order_id: logData.paypal_order_id,
      paypal_capture_id: logData.paypal_capture_id,
      user_id: logData.user_id,
      package_id: logData.package_id,
      status: logData.status,
      amount_usd: logData.amount_usd,
      coins_granted: logData.coins_granted,
      error_code: logData.error_code,
      error_message: logData.error_message,
      raw_response: logData.raw_response,
      metadata: logData.metadata,
      completed_at: logData.status === "COMPLETED" ? new Date().toISOString() : null
    }, {
      onConflict: "paypal_order_id"
    });
  
  if (error) {
    console.error("Failed to record payment log:", error);
  }
}

// Helper: Get package price from database
async function getPackagePrice(
  supabase: any,
  packageId: string
): Promise<{ price_usd: number; coins: number } | null> {
  const { data, error } = await supabase
    .from("coin_packages")
    .select("price_usd, coins")
    .eq("id", packageId)
    .maybeSingle();
  
  if (error || !data) {
    return null;
  }
  
  return { price_usd: Number(data.price_usd), coins: data.coins };
}

// Helper: Credit coins to user wallet
async function creditCoins(
  supabase: any,
  userId: string,
  coinsToAdd: number
): Promise<boolean> {
  // First try RPC function
  const { error: rpcError } = await supabase
    .rpc("add_troll_coins", {
      user_id_input: userId,
      coins_to_add: coinsToAdd
    });
  
  if (!rpcError) {
    console.log(`✅ Credited ${coinsToAdd} coins via RPC to user ${userId}`);
    return true;
  }
  
  console.warn("RPC add_troll_coins failed, trying direct update:", rpcError);
  
  // Fallback to direct update
  const { data: profile, error: selectErr } = await supabase
    .from("user_profiles")
    .select("troll_coins")
    .eq("id", userId)
    .maybeSingle();
  
  if (selectErr) {
    console.error("Failed to get user profile:", selectErr);
    return false;
  }
  
  const currentCoins = profile?.troll_coins || 0;
  const { error: updateErr } = await supabase
    .from("user_profiles")
    .update({ troll_coins: currentCoins + coinsToAdd })
    .eq("id", userId);
  
  if (updateErr) {
    console.error("Failed to update user coins:", updateErr);
    return false;
  }
  
  console.log(`✅ Credited ${coinsToAdd} coins via direct update to user ${userId}`);
  return true;
}

// Helper: Insert transaction record
async function insertTransaction(
  supabase: any,
  data: {
    user_id: string;
    paypal_order_id: string;
    paypal_capture_id: string;
    paypal_status: string;
    amount_usd: number;
    coins_granted: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from("coin_transactions")
    .insert({
      user_id: data.user_id,
      paypal_order_id: data.paypal_order_id,
      paypal_capture_id: data.paypal_capture_id,
      paypal_status: data.paypal_status,
      amount_usd: data.amount_usd,
      coins_granted: data.coins_granted
    });
  
  if (error) {
    console.error("Failed to insert coin_transaction:", error);
  } else {
    console.log("✅ Transaction logged to coin_transactions");
  }
}

// Helper: Update platform dashboard totals
async function updatePlatformDashboard(
  supabase: any,
  amountUsd: number
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  
  // Update revenue
  const { error: revenueErr } = await supabase
    .from("platform_revenue")
    .upsert({
      date: today,
      total_revenue: amountUsd,
      transaction_count: 1,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "date",
      ignoreDuplicates: false
    });
  
  if (revenueErr) {
    console.error("Failed to update platform_revenue:", revenueErr);
  }
  
  // Update profit (10% platform fee)
  const platformFee = amountUsd * 0.10;
  const { error: profitErr } = await supabase
    .from("platform_profit")
    .upsert({
      date: today,
      total_profit: platformFee,
      payment_count: 1,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "date",
      ignoreDuplicates: false
    });
  
  if (profitErr) {
    console.error("Failed to update platform_profit:", profitErr);
  }
}

// Main fulfillment handler
async function fulfillPayPalPurchase(
  req: FulfillRequest
): Promise<FulfillResponse> {
  const { orderId, packageId, userId, captureResponse } = req;
  
  console.log(`🚀 Starting fulfillment for order: ${orderId}`);
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  // Step 1: Check for existing completed payment (idempotency)
  const { data: existingLog } = await supabase
    .from("payment_logs")
    .select("id, status, coins_granted")
    .eq("paypal_order_id", orderId)
    .maybeSingle();
  
  if (existingLog?.status === "COMPLETED") {
    console.log(`⚠️ Order ${orderId} already fulfilled, returning success`);
    return {
      success: true,
      orderId,
      captureId: undefined,
      coinsAdded: existingLog.coins_granted || 0,
      usdAmount: undefined
    };
  }
  
  // Step 2: Get PayPal access token
  const accessToken = await getPayPalAccessToken();
  
  // Step 3: Fetch PayPal order details
  let orderData: PayPalOrderResponse;
  try {
    orderData = await getPayPalOrder(orderId, accessToken);
  } catch (err) {
    const error = err as Error;
    await recordPaymentLog(supabase, {
      paypal_order_id: orderId,
      status: "FAILED",
      amount_usd: 0,
      error_code: "PAYPAL_FETCH_ERROR",
      error_message: error.message,
      raw_response: { error: error.message }
    });
    throw error;
  }
  
  // Step 4: Verify capture status
  const purchaseUnit = orderData.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];
  
  if (!capture) {
    const errorMsg = "No capture found in PayPal order";
    await recordPaymentLog(supabase, {
      paypal_order_id: orderId,
      status: "FAILED",
      amount_usd: 0,
      error_code: "NO_CAPTURE",
      error_message: errorMsg,
      raw_response: orderData as unknown as Record<string, unknown>
    });
    return {
      success: false,
      orderId,
      error: errorMsg,
      errorCode: "NO_CAPTURE",
      requiresManualIntervention: true
    };
  }
  
  if (capture.status !== "COMPLETED") {
    const errorMsg = `Capture status is ${capture.status}, expected COMPLETED`;
    await recordPaymentLog(supabase, {
      paypal_order_id: orderId,
      paypal_capture_id: capture.id,
      status: "FAILED",
      amount_usd: 0,
      error_code: "CAPTURE_NOT_COMPLETED",
      error_message: errorMsg,
      raw_response: orderData as unknown as Record<string, unknown>
    });
    return {
      success: false,
      orderId,
      error: errorMsg,
      errorCode: "CAPTURE_NOT_COMPLETED"
    };
  }
  
  // Step 5: Validate currency
  const currency = capture.amount?.currency_code || purchaseUnit.amount?.currency_code;
  if (currency !== "USD") {
    const errorMsg = `Invalid currency: ${currency}, expected USD`;
    await recordPaymentLog(supabase, {
      paypal_order_id: orderId,
      paypal_capture_id: capture.id,
      status: "FAILED",
      amount_usd: 0,
      error_code: "INVALID_CURRENCY",
      error_message: errorMsg,
      raw_response: orderData as unknown as Record<string, unknown>
    });
    return {
      success: false,
      orderId,
      error: errorMsg,
      errorCode: "INVALID_CURRENCY"
    };
  }
  
  // Step 6: Parse metadata and validate amount
  const { userId: metaUserId, packageId: metaPackageId, coins, type } = parseCustomId(purchaseUnit.custom_id);
  
  const effectiveUserId = userId || metaUserId;
  const effectivePackageId = (packageId || metaPackageId) || undefined;
  
  if (!effectiveUserId) {
    const errorMsg = "Missing user_id in custom_id and request";
    await recordPaymentLog(supabase, {
      paypal_order_id: orderId,
      paypal_capture_id: capture.id,
      status: "FAILED",
      amount_usd: 0,
      error_code: "MISSING_USER_ID",
      error_message: errorMsg,
      raw_response: { custom_id: purchaseUnit.custom_id }
    });
    return {
      success: false,
      orderId,
      error: errorMsg,
      errorCode: "MISSING_USER_ID",
      requiresManualIntervention: true
    };
  }
  
  const usdAmount = Number(capture.amount?.value || purchaseUnit.amount?.value);
  
  // Step 7: Validate amount against package price if packageId provided
  if (effectivePackageId) {
    const packagePrice = await getPackagePrice(supabase, effectivePackageId);
    if (packagePrice) {
      // Allow small floating point differences (within $0.01)
      const amountDiff = Math.abs(usdAmount - packagePrice.price_usd);
      if (amountDiff > 0.02) {
        const errorMsg = `Amount mismatch: paid $${usdAmount}, package priced at $${packagePrice.price_usd}`;
        await recordPaymentLog(supabase, {
          paypal_order_id: orderId,
          paypal_capture_id: capture.id,
          user_id: effectiveUserId,
          package_id: effectivePackageId,
          status: "FAILED",
          amount_usd: usdAmount,
          error_code: "AMOUNT_MISMATCH",
          error_message: errorMsg,
          raw_response: {
            paid_amount: usdAmount,
            expected_amount: packagePrice.price_usd
          }
        });
        return {
          success: false,
          orderId,
          error: errorMsg,
          errorCode: "AMOUNT_MISMATCH",
          requiresManualIntervention: true
        };
      }
    }
  }
  
  // Step 8: Create PENDING log entry
  await recordPaymentLog(supabase, {
    paypal_order_id: orderId,
    paypal_capture_id: capture.id,
    user_id: effectiveUserId,
    package_id: effectivePackageId,
    status: "PENDING",
    amount_usd: usdAmount,
    coins_granted: coins || 0,
    metadata: {
      custom_id: purchaseUnit.custom_id,
      payer_email: orderData.payer?.email_address,
      payment_method: "paypal_web",
      order_status: orderData.status,
      type
    }
  });
  
  // Step 9: Credit coins (with error handling)
  let coinsCredited = false;
  const coinsToCredit = coins || 0;
  
  if (coinsToCredit > 0) {
    try {
      coinsCredited = await creditCoins(supabase, effectiveUserId, coinsToCredit);
    } catch (err) {
      console.error("Coin credit failed:", err);
    }
  }
  
  // Step 10: Insert transaction record
  await insertTransaction(supabase, {
    user_id: effectiveUserId,
    paypal_order_id: orderId,
    paypal_capture_id: capture.id,
    paypal_status: capture.status,
    amount_usd: usdAmount,
    coins_granted: coinsToCredit
  });
  
  // Step 11: Update platform dashboard
  await updatePlatformDashboard(supabase, usdAmount);
  
  // Step 12: Mark as COMPLETED or FAILED
  if (coinsCredited) {
    await recordPaymentLog(supabase, {
      paypal_order_id: orderId,
      paypal_capture_id: capture.id,
      user_id: effectiveUserId,
      package_id: effectivePackageId,
      status: "COMPLETED",
      amount_usd: usdAmount,
      coins_granted: coinsToCredit,
      metadata: {
        custom_id: purchaseUnit.custom_id,
        payer_email: orderData.payer?.email_address,
        payment_method: "paypal_web",
        order_status: orderData.status,
        type
      }
    });
    
    console.log(`✅ Fulfillment complete: ${coinsToCredit} coins credited to user ${effectiveUserId}`);

    try {
      await supabase.rpc("mark_user_paid", { p_user_id: effectiveUserId });
    } catch (markErr) {
      console.warn("mark_user_paid failed:", markErr);
    }
    
    return {
      success: true,
      orderId,
      captureId: capture.id,
      coinsAdded: coinsToCredit,
      usdAmount
    };
  } else {
    // Payment succeeded but coin credit failed
    await recordPaymentLog(supabase, {
      paypal_order_id: orderId,
      paypal_capture_id: capture.id,
      user_id: effectiveUserId,
      package_id: effectivePackageId,
      status: "FAILED",
      amount_usd: usdAmount,
      coins_granted: 0,
      error_code: "COIN_CREDIT_FAILED",
      error_message: "Payment completed but coin credit failed. Manual intervention required.",
      raw_response: {
        paypal_order: orderData,
        capture_response: captureResponse
      }
    });
    
    return {
      success: false,
      orderId,
      captureId: capture.id,
      error: "Payment completed but coins are delayed. Support has been notified.",
      errorCode: "COIN_CREDIT_FAILED",
      requiresManualIntervention: true
    };
  }
}

// HTTP Handler
serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed", errorCode: "INVALID_METHOD" }),
      { status: 405, headers: cors }
    );
  }
  
  try {
    const body = await req.json() as FulfillRequest;
    
    if (!body.orderId) {
      return new Response(
        JSON.stringify({ error: "Missing orderId", errorCode: "MISSING_ORDER_ID" }),
        { status: 400, headers: cors }
      );
    }
    
    console.log(`📥 Fulfillment request received:`, body);
    
    const result = await fulfillPayPalPurchase(body);
    
    const statusCode = result.success ? 200 : (result.requiresManualIntervention ? 202 : 400);
    
    return new Response(JSON.stringify(result), { status: statusCode, headers: cors });
    
  } catch (err) {
    const error = err as Error;
    console.error("❌ Fulfillment error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        errorCode: "INTERNAL_ERROR",
        message: error.message
      }),
      { status: 500, headers: cors }
    );
  }
});

console.log("✅ fulfill-paypal-purchase Edge Function initialized");
