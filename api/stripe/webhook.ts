import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = {
  api: {
    bodyParser: false,
  },
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set')
}

const WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  try {
    const rawBody = await readRawBody(req)
    const sig = req.headers['stripe-signature'] as string | undefined

    if (!sig) {
      return res.status(400).send('Missing Stripe signature')
    }

    const event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionId = session.id
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

      const { data: order, error: orderError } = await supabaseAdmin
        .from('coin_orders')
        .select('id, user_id, coins, status')
        .eq('stripe_checkout_session_id', sessionId)
        .single()

      if (orderError || !order) {
        console.warn('[stripe webhook] order not found for session', sessionId, orderError?.message)
        return res.status(200).json({ received: true })
      }

      if (order.status !== 'paid' && order.status !== 'fulfilled') {
        const { error: updateError } = await supabaseAdmin
          .from('coin_orders')
          .update({
            status: 'paid',
            stripe_payment_intent_id: paymentIntentId,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id)

        if (updateError) {
          console.error('[stripe webhook] failed to mark order paid', updateError)
          return res.status(200).json({ received: true })
        }
      }

      const { error: creditError } = await supabaseAdmin.rpc('credit_coins', {
        p_user_id: order.user_id,
        p_coins: order.coins,
        p_order_id: order.id,
      })

      if (creditError) {
        console.error('[stripe webhook] credit_coins failed', creditError)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error('[stripe webhook] error', err)
    return res.status(400).send(`Webhook Error: ${err?.message || 'Unknown error'}`)
  }
}
