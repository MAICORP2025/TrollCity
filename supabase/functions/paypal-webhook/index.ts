// paypal-webhook Edge Function
// Handles PayPal webhooks for payment events

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'

const PAYPAL_API_URL = 'https://api.paypal.com'
const PAYPAL_SANDBOX_URL = 'https://api.sandbox.paypal.com'

Deno.serve(async (req) => {
  const requestId = `paypal_webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[PayPalWebhook ${requestId}] Request received`)

  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(req)
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405, req)
  }

  try {
    const body = await req.json()
    const { event_type, resource } = body

    if (event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
      console.log(`[PayPalWebhook ${requestId}] Ignoring event type: ${event_type}`)
      return withCors({ success: true, message: 'Event ignored' }, 200, req)
    }

    const customId = resource.custom_id
    if (!customId) {
      console.error(`[PayPalWebhook ${requestId}] No custom_id in resource`)
      return withCors({ success: false, error: 'No custom_id' }, 400, req)
    }

    const metadata = customId.split('_')
    const userId = metadata[0]
    const packageId = metadata[1]
    const coins = parseInt(metadata[2]) || 0

    if (!userId || !coins) {
      console.error(`[PayPalWebhook ${requestId}] Invalid custom_id: ${customId}`)
      return withCors({ success: false, error: 'Invalid custom_id' }, 400, req)
    }

    console.log(`[PayPalWebhook ${requestId}] Processing payment for user ${userId}, coins ${coins}`)

    // Check Supabase for existing transaction
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseKey) {
      console.error(`[PayPalWebhook ${requestId}] Supabase config missing`)
      return withCors({ success: false, error: 'Config missing' }, 500, req)
    }

    // Check if transaction already exists
    const checkRes = await fetch(`${supabaseUrl}/rest/v1/transactions?external_transaction_id=eq.${resource.id}`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    })

    if (checkRes.ok) {
      const existing = await checkRes.json()
      if (existing.length > 0) {
        console.log(`[PayPalWebhook ${requestId}] Transaction already processed`)
        return withCors({ success: true, message: 'Already processed' }, 200, req)
      }
    }

    // Add coins to user
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
      console.error(`[PayPalWebhook ${requestId}] Failed to add coins: ${coinUpdateRes.status}`)
      return withCors({ success: false, error: 'Failed to credit coins' }, 500, req)
    }

    // Log transaction
    const transactionData = {
      user_id: userId,
      transaction_type: 'purchase',
      amount: parseFloat(resource.amount.value),
      description: `PayPal purchase - ${coins} coins`,
      payment_method: 'paypal',
      external_transaction_id: resource.id,
      metadata: {
        paypal_capture_id: resource.id,
        package_id: packageId,
        coins: coins,
        webhook_processed: true,
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

    console.log(`[PayPalWebhook ${requestId}] Successfully credited ${coins} coins to user ${userId}`)

    return withCors({ success: true, message: 'Processed' }, 200, req)

  } catch (err) {
    console.error(`[PayPalWebhook ${requestId}] Error:`, err)
    return withCors({ success: false, error: 'Webhook error' }, 500, req)
  }
})