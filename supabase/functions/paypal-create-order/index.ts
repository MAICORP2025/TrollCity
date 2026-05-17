import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from "../_shared/cors.ts"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) })
  }

  try {
    // 1. Rate Limit Check
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const { data: allowed, error: rateError } = await supabase.rpc('check_rate_limit', {
      p_key: `paypal_create_${ip}`,
      p_limit: 10, // 10 requests per minute
      p_window_seconds: 60
    })

    if (rateError) console.error('Rate limit error:', rateError)
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
      )
    }

    const payload = await req.json()
    const amount = payload.amount ?? payload.amountUsd ?? payload.expectedAmount
    let coins = payload.coins ?? 0
    const user_uid = payload.user_id ?? payload.userId
    const package_key = payload.package_id ?? payload.packageId

    const amtNum = Number(amount)
    if (!amtNum || amtNum <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }
    if (!user_uid || String(user_uid).trim() === '') {
      return new Response(
        JSON.stringify({ error: 'user id is required' }),
        { status: 400, headers: { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } },
      )
    }
    const cn = Number(coins)
    if (!cn || cn <= 0) {
      coins = Math.max(1, Math.round(amtNum * 100))
    }
    
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    const isSandbox = Deno.env.get('PAYPAL_MODE') === 'sandbox'
    const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

    if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials not configured')
    }

    const auth = btoa(`${clientId}:${clientSecret}`)
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    })

    if (!tokenRes.ok) {
        throw new Error('Failed to authenticate with PayPal')
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    const orderPayload = {
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: String(amtNum)
            },
            description: `${coins.toLocaleString()} Troll Coins`,
            custom_id: JSON.stringify({
              userId: user_uid,
              packageId: package_key ?? null,
              coins,
              purchaseType: "coins",
            })
        }]
    }

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
    })

    if (!orderRes.ok) {
        const errText = await orderRes.text()
        console.error('Create Order Error:', errText)
        throw new Error('Failed to create PayPal order')
    }


    const orderData = await orderRes.json()
    // Find approval URL from PayPal response
    let approvalUrl = null;
    if (orderData && orderData.links && Array.isArray(orderData.links)) {
      const approve = orderData.links.find((l) => l.rel === 'approve');
      if (approve) approvalUrl = approve.href;
    }

    return new Response(
      JSON.stringify({ orderId: orderData.id, approvalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
