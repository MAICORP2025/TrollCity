#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  try {
    console.log('Fetching live streams...')
    const { data: liveStreams, error: fetchError } = await supabase
      .from('streams')
      .select('id, status, is_live')
      .or('status.eq.live,is_live.eq.true')

    if (fetchError) {
      console.error('Failed to fetch streams:', fetchError.message)
      process.exit(1)
    }

    if (!liveStreams || liveStreams.length === 0) {
      console.log('No live streams found. Nothing to end.')
      process.exit(0)
    }

    console.log(`Ending ${liveStreams.length} stream(s)...`)

    // End all streams in bulk
    const { error: endError } = await supabase
      .from('streams')
      .update({
        status: 'ended',
        is_live: false,
        ended_at: new Date().toISOString()
      })
      .or('status.eq.live,is_live.eq.true')

    if (endError) {
      console.error('Failed to update streams:', endError.message)
    } else {
      console.log('Streams marked as ended.')
    }

    // Mark all active participants as left
    const { error: participantsError } = await supabase
      .from('streams_participants')
      .update({
        is_active: false,
        left_at: new Date().toISOString()
      })
      .eq('is_active', true)

    if (participantsError) {
      console.warn('Failed to update participants:', participantsError.message)
    } else {
      console.log('Active participants marked as left.')
    }

    // Optional: Insert logs per stream if table exists
    for (const s of liveStreams) {
      try {
        const { error: logError } = await supabase
          .from('stream_ended_logs')
          .insert({
            stream_id: s.id,
            ended_at: new Date().toISOString(),
            reason: 'ended_by_admin_bulk'
          })
        if (logError && !String(logError.message).includes('does not exist')) {
          console.warn(`Log insert failed for stream ${s.id}:`, logError.message)
        }
      } catch {
        // Ignore if table missing
      }
    }

    console.log('All streams ended successfully.')
  } catch (e) {
    console.error('Unexpected error:', e)
    process.exit(1)
  }
}

main()
