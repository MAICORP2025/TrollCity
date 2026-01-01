import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../lib/supabaseAdmin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { payout_id, admin_id } = req.body || {}

        if (!payout_id || !admin_id) {
            return res.status(400).json({ error: 'Missing payout_id or admin_id' })
        }

        const { data, error } = await supabaseAdmin
            .from('payout_requests')
            .update({
                status: 'approved',
                approved_by: admin_id,
                approved_at: new Date().toISOString(),
            })
            .eq('id', payout_id)
            .select()
            .single()

        if (error) throw error

        return res.status(200).json({ success: true, payout_request: data })
    } catch (err: any) {
        console.error('[payout-approve error]', err)
        return res.status(500).json({ error: err?.message || 'Approve failed' })
    }
}
