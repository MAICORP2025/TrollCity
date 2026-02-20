const { RtcTokenBuilder, RtcRole } = require('agora-token');

const generateAgoraToken = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    const { room, identity, role } = req.body;

    if (!room || !identity || !role) {
      return res.status(400).json({ error: 'Missing required parameters: room, identity, role' });
    }

    // Retrieve Agora credentials from environment variables
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return res.status(500).json({ error: 'Agora App ID or App Certificate not configured on server' });
    }

    // Set token expiration time
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Set Agora user role
    const agoraRole = (role === 'host' || role === 'stage') ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    // Generate the token
    const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, room, 0, agoraRole, privilegeExpiredTs);

    return res.status(200).json({ token });
  } catch (error) {
    console.error('Error generating Agora token:', error);
    return res.status(500).json({ error: 'Failed to generate Agora token' });
  }
};

module.exports = generateAgoraToken;