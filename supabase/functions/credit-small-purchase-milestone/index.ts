// Edge Function: credit-small-purchase-milestone
// Purpose: Process and award credit points for small credit-card purchases (under 100 troll coins)
//          Scans every active small purchase, determines the new milestone (25%/50%/75%/100% paid),
//          and awards credit-score points via credit-record-event for each newly-crossed threshold.
// Runtime: Deno (Edge)

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight()

  try {
    const requestId = `cspm_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`
    console.log(`[${requestId}] credit-small-purchase-milestone fired`)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Milestone threshold: 25%, 50%, 75%, 100%
    // Credit points awarded per threshold level
    const MILESTONE_POINTS: Record<number, number> = {
      0:  5,   // 25% paid
      1:  8,   // 50% paid
      2:  12,  // 75% paid
      3:  20,  // 100% fully paid
    }

    // ── 1. Fetch all active small purchases (price < 100) ──────────────────────
    const { data: purchases, error: fetchErr } = await supabase
      .from('small_installment_purchases')
      .select('id, user_id, original_price, total_paid, milestone_level, is_active, created_at, expires_at')
      .eq('is_active', true)
      .lt('original_price', 100)

    if (fetchErr) {
      console.error(`[${requestId}] fetch error:`, fetchErr.message)
      return withCors({ success: false, error: fetchErr.message }, 500)
    }

    if (!purchases || purchases.length === 0) {
      return withCors({ success: true, message: 'No active small purchases found', processed: 0 }, 200)
    }

    console.log(`[${requestId}] Found ${purchases.length} active small purchases`)
    let newMilestonesReached = 0
    let creditsAwardedTotal   = 0

    // ── 2. Process each purchase ───────────────────────────────────────────────
    for (const p of purchases) {
      const payPct  = p.total_paid / p.original_price   // 0.0 → 1.0
      const slots   = 4                                   // 0:25%,1:50%,2:75%,3:100%
      const newSlot = Math.min(Math.floor(payPct * slots), 3) // current target slot
      const cur     = p.milestone_level

      if (newSlot <= cur) continue                       // no new threshold crossed yet

      // Mark which milestones are newly crossed
      const newlyCrossed: number[] = []
      for (let lvl = cur + 1; lvl <= newSlot; lvl++) {
        // Idempotency check: has this (purchase_id, level) already been awarded?
        const { data: dup } = await supabase
          .from('installment_milestone_events')
          .select('id')
          .eq('purchase_id', p.id)
          .eq('milestone_level', lvl)
          .maybeSingle()

        if (dup) continue   // already granted — skip

        const eventKey = `milestone:${p.id}:lvl${lvl}`
        newlyCrossed.push(lvl)
        creditsAwardedTotal += MILESTONE_POINTS[lvl]!
      }

      if (newlyCrossed.length === 0) continue

      // ── 2a. Grant each new milestone ─────────────────────────────────────
      for (const lvl of newlyCrossed) {
        const eventKey = `milestone:${p.id}:lvl${lvl}`

        // Record in milestone_events (capped at 1 row per (purchase_id, level))
        await supabase.from('installment_milestone_events').insert({
          purchase_id:       p.id,
          user_id:           p.user_id,
          milestone_level:   lvl,
          credit_points_awarded: MILESTONE_POINTS[lvl]!,
          payment_amount:    p.total_paid,
          event_key:         eventKey,
        }).catch(e => console.error(`[${requestId}] milestone insert error:`, e.message))

        // Call credit-record-event
        try {
          const sbUrl = Deno.env.get('SUPABASE_URL')
          const fnUrl = sbUrl
            ? (sbUrl.endsWith('/') ? `${sbUrl}functions/v1/credit-record-event` : `${sbUrl}/functions/v1/credit-record-event`)
            : null

          if (!fnUrl) {
            console.error(`[${requestId}] SUPABASE_URL not set – cannot call credit-record-event`)
          } else {
            const resp  = await fetch(fnUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
                authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                user_id:     p.user_id,
                event_type:  'installment_milestone',
                event_key:   eventKey,
                metadata:    {
                  purchase_id:       p.id,
                  milestone_level:   lvl,
                  paid_so_far:       p.total_paid,
                  original_price:    p.original_price,
                  credit_points:     MILESTONE_POINTS[lvl],
                },
                override_delta: MILESTONE_POINTS[lvl],
              }),
            })
            const json = await resp.json().catch(() => ({}))
            if (!resp.ok) console.error(`[${requestId}] credit-record-event failed:`, json)
            else            console.log(`[${requestId}] Milestone lvl${lvl} for ${p.id}: +${MILESTONE_POINTS[lvl]}`)
          }
        } catch (httpErr: any) {
          console.error(`[${requestId}] milestone http error:`, httpErr.message)
        }
      }

      // ── 2b. Update purchase row ────────────────────────────────────────────
      const fullyPaid = newSlot >= 3 // 100%
      await supabase.from('small_installment_purchases').update({
        milestone_level: newSlot,
        is_active:       !fullyPaid,
        fully_paid_at:   fullyPaid ? new Date().toISOString() : null,
        updated_at:      new Date().toISOString(),
      }).eq('id', p.id).catch(e => console.error(`[${requestId}] purchase update error:`, e.message))

      newMilestonesReached++
    }

    // ── 3. Expire old, unpaid purchases (> 30 days since creation) ─────────────
    const expiryDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: expired, error: expireErr } = await supabase
      .from('small_installment_purchases')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('is_active', true)
      .lt('created_at', expiryDate)
      .select('id')
    if (expireErr) console.error(`[${requestId}] expire error:`, expireErr.message)

    return withCors({
      success:            true,
      processed:          purchases.length,
      newMilestonesReached,
      creditsAwardedTotal,
      expired:            expired?.length ?? 0,
    }, 200)

  } catch (err: any) {
    console.error('credit-small-purchase-milestone error:', err)
    return withCors({ success: false, error: err.message || 'Internal error' }, 500)
  }
})
