import { handleCorsPreflight, withCors } from "../_shared/cors.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@^2.0.5";

/**
 * Agora Token Generator
 * Generates RTC tokens for Agora video meetings using official Agora token builder
 */

function generateAgoraToken(params: {
  appId: string;
  appCertificate: string;
  channelName: string;
  uid: number;
  expiration?: number;
}): string {
  const {
    appId,
    appCertificate,
    channelName,
    uid,
    expiration = 3600
  } = params;

  try {
    // Use official Agora RTC Token Builder
    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      expiration
    );

    return token;
  } catch (error) {
    console.error('[agora-token] Error generating token:', error);
    throw error;
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const body = await req.json();

    const channelName = body.channel || body.channelName || 'staff_meeting';
    const userIdStr = body.userId || body.user_id || body.uid || '0';
    const uid = parseInt(userIdStr as string, 10);

    const appId = Deno.env.get('VITE_AGORA_APP_ID') || Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('VITE_AGORA_APP_CERTIFICATE') || Deno.env.get('AGORA_APP_CERTIFICATE');

    // Guard: Check for missing environment variables
    if (!appId || !appCertificate) {
      console.error('[agora-token] Agora credentials NOT configured:', {
        hasAppId: !!appId,
        hasCertificate: !!appCertificate
      });

      return withCors({
        error: 'Agora credentials not configured',
        hint: 'Set VITE_AGORA_APP_ID and VITE_AGORA_APP_CERTIFICATE in Supabase environment',
        appId: appId ? 'set' : 'missing',
        certificate: appCertificate ? 'set' : 'missing'
      }, 500, req);
    }

    console.log('[agora-token] Generating token:', {
      channel: channelName,
      uid: uid,
      appId: appId.substring(0, 8) + '...'
    });

    const token = generateAgoraToken({
      appId,
      appCertificate,
      channelName,
      uid,
      expiration: 3600
    });

    console.log('[agora-token] ✅ Token generated successfully');

    return withCors({
      token,
      channel: channelName,
      uid,
      appId
    }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[agora-token] ❌ Error:', message);
    return withCors({
      error: 'Failed to generate token',
      details: message
    }, 500, req);
  }
});
