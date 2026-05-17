import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../lib/supabaseAdmin'

export const runtime = 'edge'

export async function GET() {
  try {
    // Get the active/latest mai class
    const { data: classData, error: classError } = await supabaseAdmin
      .from('mai_classes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (classError || !classData) {
      return new Response(JSON.stringify({
        error: 'No active Mai Class found',
        code: 'NO_ACTIVE_CLASS'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get enrollment count
    const { count } = await supabaseAdmin
      .from('mai_class_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classData.id)
      .eq('status', 'enrolled')

    const classWithCount = { ...classData, current_student_count: count || 0 }

    // Fetch instructor profile separately
    const { data: instructor } = await supabaseAdmin
      .from('user_profiles')
      .select('username, avatar_url, troll_coins, trollmonds')
      .eq('id', classData.instructor_id)
      .single()

    return new Response(JSON.stringify({
      class: classWithCount,
      instructor: instructor || null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('[get active mai class error]', err)
    return new Response(JSON.stringify({
      error: err?.message || 'Failed to fetch active class'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
