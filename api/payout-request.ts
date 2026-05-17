import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../lib/supabaseAdmin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { user_id, amount_coins, amount_usd, currency } = req.body || {}

        if (!user_id || !amount_coins || !amount_usd) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

        const { data, error } = await supabaseAdmin
            .from('payout_requests')
            .insert([
                {
                    user_id,
                    amount_coins,
                    amount_usd,
                    currency: currency || 'USD',
                    status: 'pending',
                },
            ])
            .select()
            .single()

        if (error) throw error

        return res.status(200).json({ success: true, payout_request: data })
    } catch (err: any) {
        console.error('[payout-request error]', err)
        return res.status(500).json({ error: err?.message || 'Request failed' })
    }
}
