import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const APP_URL = process.env.APP_URL

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

if (!STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY must be set')
}

if (!APP_URL) {
  throw new Error('APP_URL must be set')
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

    const { packageId } = req.body || {}
    if (!packageId) {
      return res.status(400).json({ error: 'Missing packageId' })
    }

    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from('coin_packages')
      .select('id, coins, price_usd, amount_cents, stripe_price_id, is_active')
      .eq('id', packageId)
      .single()

    if (pkgError || !pkg) {
      return res.status(404).json({ error: 'Package not found' })
    }

    if (!pkg.is_active) {
      return res.status(400).json({ error: 'Package inactive' })
    }

    if (!pkg.stripe_price_id) {
      return res.status(400).json({ error: 'Package missing stripe_price_id' })
    }

    const amountCents =
      typeof pkg.amount_cents === 'number'
        ? pkg.amount_cents
        : Math.round(Number(pkg.price_usd || 0) * 100)

    const { data: stripeCustomer } = await supabaseAdmin
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
      success_url: `${APP_URL}/wallet?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/wallet?canceled=1`,
      customer: stripeCustomer?.stripe_customer_id || undefined,
      client_reference_id: authData.user.id,
      metadata: {
        user_id: authData.user.id,
        package_id: pkg.id,
        coins: String(pkg.coins ?? 0),
      },
    })

    const { error: orderError } = await supabaseAdmin.from('coin_orders').insert({
      user_id: authData.user.id,
      package_id: pkg.id,
      coins: pkg.coins,
      amount_cents: amountCents,
      status: 'created',
      stripe_checkout_session_id: session.id,
    })

    if (orderError) {
      console.error('[stripe] failed to insert coin_orders:', orderError)
      return res.status(500).json({ error: 'Failed to create order' })
    }

    return res.status(200).json({ url: session.url })
  } catch (error: any) {
    console.error('[stripe] create-checkout-session error:', error)
    return res.status(500).json({ error: error?.message || 'Server error' })
  }
}
