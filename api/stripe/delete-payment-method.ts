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

    const { id } = req.body || {}
    if (!id) {
      return res.status(400).json({ error: 'Missing id' })
    }

    const { data: method, error: methodError } = await supabaseAdmin
      .from('user_payment_methods')
      .select('id, user_id, stripe_payment_method_id')
      .eq('id', id)
      .single()

    if (methodError || !method) {
      return res.status(404).json({ error: 'Payment method not found' })
    }

    if (method.user_id !== authData.user.id) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (method.stripe_payment_method_id) {
      await stripe.paymentMethods.detach(method.stripe_payment_method_id)
    }

    const { error: deleteError } = await supabaseAdmin
      .from('user_payment_methods')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return res.status(500).json({ error: 'Failed to delete payment method' })
    }

    return res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('[stripe] delete-payment-method error:', error)
    return res.status(500).json({ error: error?.message || 'Server error' })
  }
}
