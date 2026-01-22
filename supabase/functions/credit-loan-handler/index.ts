// Edge Function: credit-loan-handler
// Purpose: React to loan payment events and push credit score updates
// Runtime: Deno (Edge)

export const config = { runtime: "edge" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREDIT_ENDPOINT = "/functions/v1/credit-record-event"; // relative to Supabase URL

async function postCreditEvent(body: Record<string, unknown>) {
  const url = `${Deno.env.get("SUPABASE_URL")}${CREDIT_ENDPOINT}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error || `Failed to post credit event: ${resp.status}`);
  }
  return json;
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  try {
    const body = await req.json();
    const {
      borrower_id,
      loan_id,
      event_key,
      was_late = false,
      late_days = 0,
      defaulted = false,
      missed_payment = false,
      status,
    } = body || {};

    if (!borrower_id || !loan_id) {
      return new Response(JSON.stringify({ error: "borrower_id and loan_id are required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let event_type = "loan_on_time_payment";
    let override_delta: number | undefined;
    const meta = { loan_id, status, was_late, late_days, defaulted, missed_payment };

    if (defaulted) {
      event_type = "loan_default";
    } else if (missed_payment) {
      event_type = "loan_missed_payment";
    } else if (was_late || (late_days ?? 0) > 0) {
      event_type = "loan_late_payment";
      // scale penalty by late days but respect cap via main function
      override_delta = -2 * Math.max(1, Number(late_days) || 1);
    } else if (status === "paid_off" || status === "closed") {
      event_type = "loan_full_payoff";
    } else {
      event_type = "loan_on_time_payment";
    }

    const result = await postCreditEvent({
      user_id: borrower_id,
      event_type,
      event_key: event_key ?? `loan:${loan_id}:${event_type}:${late_days}`,
      metadata: meta,
      override_delta,
    });

    return new Response(JSON.stringify({ success: true, credit: result }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("credit-loan-handler error", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}
