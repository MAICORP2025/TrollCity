// api/paypal/capture-order.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { orderId } = req.body;
  if (!orderId) {
    res.status(400).json({ error: 'Missing orderId' });
    return;
  }

  // Load PayPal credentials from env
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const baseUrl = process.env.PAYPAL_API_BASE_URL || 'https://api-m.paypal.com';

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: 'PayPal credentials not set' });
    return;
  }

  // Get OAuth token
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  let accessToken;
  try {
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
    if (!accessToken) throw new Error('No access token');
  } catch (err) {
    res.status(500).json({ error: 'Failed to get PayPal access token', details: err.message });
    return;
  }

  // Capture order
  try {
    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const captureData = await captureRes.json();
    if (!captureData.id) throw new Error(captureData.message || 'No capture ID');
    res.status(200).json({ success: true, transactionId: captureData.id, raw: captureData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to capture PayPal order', details: err.message });
  }
};