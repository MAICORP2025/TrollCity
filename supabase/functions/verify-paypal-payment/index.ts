// verify-paypal-payment Edge Function
// Verifies and captures PayPal payments

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'

const PAYPAL_API_URL = 'https://api.paypal.com'
const PAYPAL_SANDBOX_URL = 'https://api.sandbox.paypal.com'

Deno.serve(async (req) => {
  const requestId = `paypal_verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[VerifyPayPalPayment ${requestId}] Request received`)

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req)
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405, req)
  }

  try {
    const body = await req.json()
    const { orderId, paypalOrderId, expectedAmount } = body

    if (!paypalOrderId) {
      return withCors({ success: false, error: 'PayPal order ID is required' }, 400, req)
    }

    // PayPal credentials from environment
    const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID')
    const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')
    const PAYPAL_ENVIRONMENT = 'live'

    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      console.error(`[VerifyPayPalPayment ${requestId}] PayPal credentials not configured`)
      return withCors({ success: false, error: 'Payment system not configured' }, 500, req)
    }

    const baseUrl = PAYPAL_ENVIRONMENT === 'live' ? PAYPAL_API_URL : PAYPAL_SANDBOX_URL

    // Get PayPal access token
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!tokenRes.ok) {
      const error = await tokenRes.json()
      console.error(`[VerifyPayPalPayment ${requestId}] Token request failed:`, error)
      return withCors({ success: false, error: 'Failed to authenticate with PayPal' }, 500, req)
    }

    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // Get order details
    const orderDetailsRes = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!orderDetailsRes.ok) {
      const error = await orderDetailsRes.json()
      console.error(`[VerifyPayPalPayment ${requestId}] Failed to get order details:`, error)
      return withCors({ success: false, error: 'Failed to verify payment' }, 500, req)
    }

    const orderDetails = await orderDetailsRes.json()

    // Check if payment is approved
    if (orderDetails.status !== 'APPROVED') {
      console.log(`[VerifyPayPalPayment ${requestId}] Payment not approved: ${orderDetails.status}`)
      return withCors({
        verified: false,
        status: orderDetails.status,
        error: 'Payment not approved yet'
      }, 200, req)
    }

    // Verify amount matches expected
    const paidAmount = parseFloat(orderDetails.purchase_units[0].amount.value)
    if (expectedAmount && Math.abs(paidAmount - expectedAmount) > 0.01) {
      console.error(`[VerifyPayPalPayment ${requestId}] Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`)
      return withCors({ success: false, error: 'Payment amount mismatch' }, 400, req)
    }

    // Capture the payment
    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!captureRes.ok) {
      const error = await captureRes.json()
      console.error(`[VerifyPayPalPayment ${requestId}] Capture failed:`, error)
      return withCors({ success: false, error: 'Failed to capture payment' }, 500, req)
    }

    const captureData = await captureRes.json()

    // Extract payment details
    const purchaseUnit = orderDetails.purchase_units[0]
    const metadata = purchaseUnit.custom_id.split('_')
    const userId = metadata[0]
    const packageId = metadata[1]
    const coins = parseInt(metadata[2]) || 0
    const purchaseType = metadata[3] || 'coins'

    // Process the purchase (add coins, etc.)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (supabaseUrl && supabaseKey) {
      try {
        // Add coins to user
        if (coins > 0) {
          const coinUpdateRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              troll_coins: `troll_coins + ${coins}`,
              total_earned_coins: `total_earned_coins + ${coins}`,
            }),
          })

          if (!coinUpdateRes.ok) {
            console.warn(`[VerifyPayPalPayment ${requestId}] Failed to add coins to user`)
          }
        }

        // Log the transaction
        const transactionData = {
          user_id: userId,
          transaction_type: 'purchase',
          amount: paidAmount,
          description: purchaseUnit.description || `${coins} Troll Coins`,
          payment_method: 'paypal',
          external_transaction_id: paypalOrderId,
          metadata: {
            paypal_capture_id: captureData.id,
            package_id: packageId,
            purchase_type: purchaseType,
            coins: coins,
          },
        }

        await fetch(`${supabaseUrl}/rest/v1/transactions`, {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(transactionData),
        })

      } catch (dbErr) {
        console.error(`[VerifyPayPalPayment ${requestId}] Database update error:`, dbErr)
      }
    }

    console.log(`[VerifyPayPalPayment ${requestId}] Success: Payment captured ${captureData.id}`)

    return withCors({
      verified: true,
      paypalOrderId,
      captureId: captureData.id,
      amount: paidAmount,
      coins,
      userId,
      packageId,
      purchaseType,
    }, 200, req)

  } catch (err) {
    console.error(`[VerifyPayPalPayment ${requestId}] Error:`, err)
    return withCors({ success: false, error: 'Payment verification error' }, 500, req)
  }
})