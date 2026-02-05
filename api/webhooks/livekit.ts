import { createClient } from '@supabase/supabase-js';
import { EgressClient } from 'livekit-server-sdk';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Initialize Supabase Client (Note: Vercel environment variables)
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event, room, egress } = req.body;
    console.log('LiveKit webhook received (Vercel):', { event, room });

    if (event === 'room_started') {
      const roomId = room.name;

      // 1. Mark stream as live in DB
      await supabase.from('streams').update({
        status: 'live',
        is_live: true,
        start_time: new Date().toISOString(),
      }).eq('id', roomId);

      // 2. Update Pods/Courts (Fire and forget)
      Promise.all([
        supabase.from('pod_rooms').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', roomId),
        supabase.from('court_sessions').update({ status: 'live', started_at: new Date().toISOString() }).eq('id', roomId),
      ]).catch(err => console.error('Error updating pod/court:', err));

      // 3. Trigger HLS Egress
      await startEgress(roomId);

    } else if (event === 'room_finished') {
      const roomId = room.name;

      // Mark as ended
      await supabase.from('streams').update({
        status: 'ended',
        is_live: false,
        ended_at: new Date().toISOString(),
      }).eq('id', roomId);

      Promise.all([
        supabase.from('pod_rooms').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', roomId),
        supabase.from('court_sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', roomId),
      ]).catch(err => console.error('Error ending pod/court:', err));

    } else if (event === 'egress_ended') {
      const file = egress?.file || egress?.file_results?.[0];
      const recordingUrl = file?.location || file?.filename;
      const roomName = egress?.room_name;

      if (roomName && recordingUrl) {
        await supabase.from('streams').update({ recording_url: recordingUrl }).eq('id', roomName);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function startEgress(roomId: string) {
  const livekitUrl = process.env.VITE_LIVEKIT_URL || process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!livekitUrl || !apiKey || !apiSecret) {
    console.warn('Missing LiveKit credentials');
    return;
  }

  const httpUrl = livekitUrl.replace('wss://', 'https://');
  const egressClient = new EgressClient(httpUrl, apiKey, apiSecret);

  // S3 Configuration (Prefer Environment Variables)
  const s3Bucket = process.env.S3_BUCKET || 'hls'; // Default to 'hls' if using Supabase
  const s3Key = process.env.S3_ACCESS_KEY;
  const s3Secret = process.env.S3_SECRET_KEY;
  const s3Endpoint = process.env.S3_ENDPOINT;
  const s3Region = process.env.S3_REGION || 'us-east-1';

  const segmentsOptions: any = {
    protocol: 1, // ProtocolType.S3
    filenamePrefix: `streams/${roomId}/`,
    playlistName: 'master.m3u8',
    segmentDuration: 4,
  };

  if (s3Bucket && s3Key && s3Secret) {
    segmentsOptions.s3 = {
      accessKey: s3Key,
      secret: s3Secret,
      bucket: s3Bucket,
      endpoint: s3Endpoint,
      region: s3Region,
    };
  }

  try {
    console.log(`Starting egress for room ${roomId}`);
    await egressClient.startRoomCompositeEgress(roomId, {
      segments: segmentsOptions,
    }, {
      layout: 'grid',
    });

    // Update HLS URL
    const hlsBaseUrl = process.env.VITE_HLS_BASE_URL; // e.g. https://cdn.maitrollcity.com
    let hlsUrl = '';

    if (hlsBaseUrl) {
      hlsUrl = `${hlsBaseUrl}/streams/${roomId}/master.m3u8`;
    } else {
       // Fallback for Supabase Storage
       hlsUrl = `${supabaseUrl}/storage/v1/object/public/${s3Bucket}/streams/${roomId}/master.m3u8`;
    }

    await supabase.from('streams').update({ hls_url: hlsUrl }).eq('id', roomId);
    console.log(`HLS URL updated: ${hlsUrl}`);

  } catch (error) {
    console.error('Failed to start egress:', error);
  }
}
