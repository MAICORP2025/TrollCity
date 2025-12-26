import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const config = {
  runtime: "edge",
  schedule: "0 20 * * 1", // 1:00 PM Mountain Standard Time is 20:00 UTC on Mondays
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID")!;
const PAYPAL_CLIENT_SECRET = Deno.env.get("PAYPAL_CLIENT_SECRET")!;
const PAYPAL_MODE = (Deno.env.get("PAYPAL_MODE") ?? "live").toLowerCase();
const PAYPAL_BASE =
  PAYPAL_MODE === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://trollcity.app",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type PayoutRequestRow = {
  id: string;
  user_id: string;
  status: string;
  requested_coins?: number;
  coins_redeemed?: number;
  coins_used?: number;
  coin_amount?: number;
  usd_amount?: number;
  usd_value?: number;
  amount_usd?: number;
  cash_amount?: number;
  net_amount?: number;
  net_value?: number;
  paypal_fee?: number;
  processing_fee?: number;
  paypal_email?: string;
  payout_address?: string;
  currency?: string;
  payout_currency?: string;
  requested_at?: string;
  admin_notes?: string;
};

type PayoutSettings = {
  coinToUsdRate: number;
  paypalFeePercentage: number;
  paypalFixedFee: number;
  maxDailyPayouts: number;
};

const DEFAULT_SETTINGS: PayoutSettings = {
  coinToUsdRate: 0.01,
  paypalFeePercentage: 2.9,
  paypalFixedFee: 0.3,
  maxDailyPayouts: 40,
};

const maskEmail = (value?: string | null) => {
  if (!value) return null;
  const [local, domain] = value.split("@");
  if (!domain) return "***";
  const prefix = local.slice(0, 3);
  return `${prefix}***@${domain}`;
};

const loadPayoutSettings = async (): Promise<PayoutSettings> => {
  const { data, error } = await supabase
    .from("payout_settings")
    .select("setting_key, setting_value")
    .in("setting_key", [
      "coin_to_usd_rate",
      "paypal_fee_percentage",
      "paypal_fixed_fee",
      "max_daily_payouts",
    ]);

  if (error) {
    console.error("Failed to load payout settings:", error);
    return DEFAULT_SETTINGS;
  }

  const map = new Map<string, string>();
  data?.forEach((row) => {
    if (row.setting_key) map.set(row.setting_key, row.setting_value);
  });

  const parseNumber = (value: string | undefined, fallback: number) => {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  return {
    coinToUsdRate: parseNumber(map.get("coin_to_usd_rate"), DEFAULT_SETTINGS.coinToUsdRate),
    paypalFeePercentage: parseNumber(
      map.get("paypal_fee_percentage"),
      DEFAULT_SETTINGS.paypalFeePercentage
    ),
    paypalFixedFee: parseNumber(map.get("paypal_fixed_fee"), DEFAULT_SETTINGS.paypalFixedFee),
    maxDailyPayouts: Math.max(
      1,
      parseNumber(map.get("max_daily_payouts"), DEFAULT_SETTINGS.maxDailyPayouts)
    ),
  };
};

const fetchPayPalToken = async () => {
  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });

  const tokenData = await response.json();
  if (!response.ok) {
    console.error("PayPal token refresh failed:", tokenData);
    throw new Error("PayPal authentication failed");
  }

  return tokenData;
};

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildAmount = (
  request: PayoutRequestRow,
  settings: PayoutSettings
): { usdAmount: number; netAmount: number; feeAmount: number } => {
  const coins =
    toNumber(request.requested_coins) ||
    toNumber(request.coins_redeemed) ||
    toNumber(request.coins_used) ||
    toNumber(request.coin_amount);

  let usdAmount =
    toNumber(request.usd_amount) ||
    toNumber(request.usd_value) ||
    toNumber(request.amount_usd) ||
    toNumber(request.cash_amount);

  if (usdAmount <= 0 && coins > 0) {
    usdAmount = coins * settings.coinToUsdRate;
  }

  const netFromRow =
    toNumber(request.net_amount) || toNumber(request.net_value) || toNumber(request.amount_usd);

  const feeFromRow = toNumber(request.paypal_fee) || toNumber(request.processing_fee);

  const computedFee =
    feeFromRow > 0
      ? feeFromRow
      : (usdAmount * (settings.paypalFeePercentage / 100) + settings.paypalFixedFee);

  const netAmount =
    netFromRow > 0 ? netFromRow : Math.max(parseFloat((usdAmount - computedFee).toFixed(2)), 0);

  return {
    usdAmount: parseFloat(usdAmount.toFixed(2)),
    netAmount,
    feeAmount: parseFloat(computedFee.toFixed(2)),
  };
};

const getRecipientEmail = (request: PayoutRequestRow) =>
  request.paypal_email ||
  request.payout_address ||
  (request as any).paypal_email_address ||
  (request as any).payout_email ||
  null;

const processPayoutRequest = async (
  request: PayoutRequestRow,
  token: string,
  settings: PayoutSettings
) => {
  const recipientEmail = getRecipientEmail(request);

  if (!recipientEmail) {
    throw new Error(`Missing PayPal email for payout ${request.id}`);
  }

  const { usdAmount, netAmount, feeAmount } = buildAmount(request, settings);
  const currency =
    request.currency ||
    request.payout_currency ||
    (request as any).usd_currency ||
    "USD";

  const payoutPayload = {
    sender_batch_header: {
      sender_batch_id: `auto_payout_${request.id}_${Date.now()}`,
      email_subject: "Your Troll City payout is on its way",
      email_message: "Thanks for being a creator. Your payout was processed automatically today.",
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: {
          value: netAmount.toFixed(2),
          currency,
        },
        receiver: recipientEmail,
        note: `Troll City creator payout (${request.id})`,
        sender_item_id: request.id,
      },
    ],
  };

  const payoutResponse = await fetch(`${PAYPAL_BASE}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payoutPayload),
  });

  const payoutResult = await payoutResponse.json();
  if (!payoutResponse.ok) {
    console.error("PayPal payout failure:", payoutResult);
    throw new Error(
      payoutResult.message || payoutResult.name || "PayPal payout request failed"
    );
  }

  const updates = {
    status: "completed",
    completed_at: new Date().toISOString(),
    paypal_batch_id: payoutResult.batch_header?.payout_batch_id || null,
    paypal_batch_status: payoutResult.batch_header?.batch_status || null,
    usd_amount: usdAmount,
    net_amount: netAmount,
    paypal_fee: feeAmount,
    admin_notes: "Auto-processed via Monday payout schedule",
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("payout_requests")
    .update(updates)
    .eq("id", request.id);

  if (updateError) {
    console.error("Unable to persist payout completion status:", updateError);
  }

  const { error: auditError } = await supabase.from("payout_audit_log").insert({
    payout_request_id: request.id,
    action: "auto-processed",
    processed_by: null,
    paypal_batch_id: payoutResult.batch_header?.payout_batch_id || null,
    amount: netAmount,
    recipient_email: maskEmail(recipientEmail),
    created_at: new Date().toISOString(),
  });

  if (auditError) {
    console.error("Failed to persist payout audit record:", auditError);
  }

  return {
    id: request.id,
    batch_id: payoutResult.batch_header?.payout_batch_id,
    status: "completed",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const settings = await loadPayoutSettings();
    const { data: approvedRequests, error: fetchError } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("status", "approved")
      .order("requested_at", { ascending: true })
      .limit(settings.maxDailyPayouts);

    if (fetchError) {
      throw fetchError;
    }

    if (!approvedRequests || approvedRequests.length === 0) {
      return new Response(
        JSON.stringify({ message: "No approved payouts to process" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await fetchPayPalToken();
    if (!tokenData.access_token) {
      throw new Error("PayPal access token missing");
    }
    const results = [];

    for (const request of approvedRequests) {
      const now = new Date().toISOString();
      const { data: lockData } = await supabase
        .from("payout_requests")
        .update({ status: "processing", processed_at: now })
        .eq("id", request.id)
        .eq("status", "approved")
        .select("id")
        .maybeSingle();

      if (!lockData) {
        results.push({ id: request.id, status: "skipped", reason: "concurrent update" });
        continue;
      }

      try {
        const payoutResult = await processPayoutRequest(
          request,
          tokenData.access_token,
          settings
        );
        results.push(payoutResult);
      } catch (error: any) {
        console.error(`Auto payout failed for ${request.id}:`, error);
        await supabase
          .from("payout_requests")
          .update({
            status: "failed",
            admin_notes: `Auto payout error: ${error.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", request.id);

        const { error: auditInsertErr } = await supabase.from("payout_audit_log").insert({
          payout_request_id: request.id,
          action: "auto-failed",
          processed_by: null,
          amount: toNumber(request.net_amount),
          recipient_email: maskEmail(getRecipientEmail(request)),
          created_at: new Date().toISOString(),
        });

        if (auditInsertErr) {
          console.error("Failed to log auto payout failure:", auditInsertErr);
        }

        results.push({
          id: request.id,
          status: "failed",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Automatic payouts processed",
        count: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Automatic payouts failed:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Automatic payouts failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
