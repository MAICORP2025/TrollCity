import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../../lib/supabaseAdmin'

export const runtime = 'edge'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = getBearerToken(req)
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const userId = authData.user.id

    // Check admin status
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role, is_admin')
      .eq('id', userId)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'owner' && profile.role !== 'ceo' && !profile.is_admin)) {
      return res.status(403).json({ error: 'Only admins can start class' })
    }

    const { classId } = req.body || {}

    if (!classId) {
      return res.status(400).json({ error: 'classId is required' })
    }

    // Fetch class and verify instructor
    const { data: existingClass, error: fetchError } = await supabaseAdmin
      .from('mai_classes')
      .select('*')
      .eq('id', classId)
      .single()

    if (fetchError || !existingClass) {
      return res.status(404).json({ error: 'Class not found' })
    }

    if (existingClass.instructor_id !== userId) {
      return res.status(403).json({ error: 'Only the instructor can start this class' })
    }

    // Generate LiveKit room name
    const roomName = `mai-class-${classId}-${Date.now()}`

    // Update class to live
    const { data: updatedClass, error: updateError } = await supabaseAdmin
      .from('mai_classes')
      .update({
        session_status: 'live',
        session_start_time: new Date().toISOString(),
        livekit_room_name: roomName,
      })
      .eq('id', classId)
      .select()
      .single()

    if (updateError) {
      console.error('[start class error]', updateError)
      return res.status(500).json({ error: 'Failed to start class' })
    }

    return res.status(200).json({ success: true, class: updatedClass })
  } catch (err: any) {
    console.error('[start class]', err)
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
}

function getBearerToken(req: VercelRequest): string {
  const header = req.headers?.authorization || req.headers?.Authorization
  if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
    throw new Error('Missing auth token')
  }
  return header.slice('Bearer '.length).trim()
}
