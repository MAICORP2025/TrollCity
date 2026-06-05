const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  console.error('[ghost-mode.js] 🔴 CRITICAL: SUPABASE_URL not set in environment');
}
if (!supabaseServiceKey) {
  console.error('[ghost-mode.js] 🔴 CRITICAL: SUPABASE_SERVICE_ROLE_KEY not set in environment');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function isCEO(userId) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role, is_admin, is_ceo')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[isCEO] Error checking CEO status:', error.message);
    return false;
  }

  return !!(profile?.is_ceo || profile?.role === 'ceo' || profile?.is_admin);
}

async function createGhostSession(req, res) {
  try {
    const { streamId, userId } = req.body;

    if (!streamId || !userId) {
      return res.status(400).json({ error: 'streamId and userId required' });
    }

    const ceoCheck = await isCEO(userId);
    if (!ceoCheck) {
      return res.status(403).json({ error: 'Only CEOs can join ghost mode' });
    }

    const { data: stream, error: streamError } = await supabase
      .from('streams')
      .select('id, livekit_room_name, status, is_live')
      .eq('id', streamId)
      .maybeSingle();

    if (streamError || !stream) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    if (!stream.is_live && stream.status !== 'live') {
      return res.status(400).json({ error: 'Stream is not live' });
    }

    const { data: existingSession, error: existingError } = await supabase
      .from('ghost_stream_sessions')
      .select('id')
      .eq('stream_id', streamId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingError) {
      console.error('[createGhostSession] Error checking existing session:', existingError.message);
    }

    if (existingSession) {
      return res.status(200).json({
        success: true,
        message: 'Ghost session already exists',
        sessionId: existingSession.id,
        roomName: stream.livekit_room_name || streamId,
      });
    }

    const { data, error } = await supabase
      .from('ghost_stream_sessions')
      .insert({
        stream_id: streamId,
        user_id: userId,
        microphone_enabled: true,
        camera_enabled: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[createGhostSession] Error creating session:', error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      sessionId: data.id,
      streamId: data.stream_id,
      roomName: stream.livekit_room_name || streamId,
    });

  } catch (err) {
    console.error('[createGhostSession] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function leaveGhostSession(req, res) {
  try {
    const { streamId, userId } = req.body;

    if (!streamId || !userId) {
      return res.status(400).json({ error: 'streamId and userId required' });
    }

    const ceoCheck = await isCEO(userId);
    if (!ceoCheck) {
      return res.status(403).json({ error: 'Only CEOs can leave ghost sessions' });
    }

    const { error } = await supabase
      .from('ghost_stream_sessions')
      .delete()
      .eq('stream_id', streamId)
      .eq('user_id', userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, message: 'Ghost session ended' });

  } catch (err) {
    console.error('[leaveGhostSession] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getGhostSessions(req, res) {
  try {
    const { streamId, userId } = req.query;

    if (!streamId) {
      return res.status(400).json({ error: 'streamId required' });
    }

    const ceoCheck = await isCEO(userId || '');
    if (!ceoCheck) {
      return res.status(403).json({ error: 'Only CEOs can view ghost sessions' });
    }

    const { data, error } = await supabase
      .from('ghost_stream_sessions')
      .select('id, user_id, joined_at, microphone_enabled, camera_enabled')
      .eq('stream_id', streamId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, sessions: data || [] });

  } catch (err) {
    console.error('[getGhostSessions] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createGhostSession,
  leaveGhostSession,
  getGhostSessions,
};