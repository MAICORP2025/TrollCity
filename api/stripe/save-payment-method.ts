import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set')
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

function getBearerToken(req: VercelRequest): string {
  const header = req.headers?.authorization || req.headers?.Authorization
  if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
    throw new Error('Missing auth token')
  }

  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw new Error('Missing auth token')
  }

  return token
}

async function getOrCreateCustomer(userId: string) {
  const { data: existing } = await supabaseAdmin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id
  }

  const customer = await stripe.customers.create({
    metadata: { user_id: userId },
  })

  const { error: insertError } = await supabaseAdmin
    .from('stripe_customers')
    .insert({ user_id: userId, stripe_customer_id: customer.id })

  if (insertError) {
    console.error('[stripe] failed to insert stripe_customer', insertError)
  }

  return customer.id
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const token = getBearerToken(req)
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { paymentMethodId } = req.body || {}
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Missing paymentMethodId' })
    }

    const customerId = await getOrCreateCustomer(authData.user.id)

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
    if (!paymentMethod || paymentMethod.customer && paymentMethod.customer !== customerId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    await supabaseAdmin
      .from('user_payment_methods')
      .update({ is_default: false })
      .eq('user_id', authData.user.id)

    const card = paymentMethod.card
    const displayName = card
      ? `${card.brand?.toUpperCase() || 'Card'} •••• ${card.last4 || ''}`
      : paymentMethod.type

    const { data: savedMethod, error: saveError } = await supabaseAdmin
      .from('user_payment_methods')
      .upsert({
        user_id: authData.user.id,
        provider: 'stripe',
        token_id: paymentMethodId,
        display_name: displayName,
        brand: card?.brand || null,
        last4: card?.last4 || null,
        exp_month: card?.exp_month || null,
        exp_year: card?.exp_year || null,
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
        is_default: true,
      }, { onConflict: 'user_id,provider,token_id' })
      .select()
      .single()

    if (saveError) {
      console.error('[stripe] save-payment-method error:', saveError)
      return res.status(500).json({ error: 'Failed to save payment method' })
    }

    return res.status(200).json({ success: true, method: savedMethod })
  } catch (error: any) {
    console.error('[stripe] save-payment-method error:', error)
    return res.status(500).json({ error: error?.message || 'Server error' })
  }
}
