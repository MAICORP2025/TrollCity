// api/paypal/create-order.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { amount, currency, userId, productType, packageId, metadata } = req.body;
  if (!amount || !currency) {
    res.status(400).json({ error: 'Missing amount or currency' });
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

  // Create order
  try {
    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
            custom_id: userId,
            description: `${productType || 'Purchase'}${packageId ? ' - ' + packageId : ''}`,
            invoice_id: `${userId}-${Date.now()}`,
            ...(metadata ? { reference_id: JSON.stringify(metadata) } : {}),
          },
        ],
        application_context: {
          brand_name: 'Troll City',
          user_action: 'PAY_NOW',
          return_url: process.env.PAYPAL_RETURN_URL || 'https://localhost:5173/coins-complete?success=true',
          cancel_url: process.env.PAYPAL_CANCEL_URL || 'https://localhost:5173/coins-complete?canceled=true',
        },
      }),
    });
    let orderData, rawText;
    try {
      rawText = await orderRes.text();
      orderData = JSON.parse(rawText);
    } catch {
      // Error thrown by JSON.parse if the response is not valid JSON
      console.error('[PayPal] Non-JSON or empty response:', rawText);
      return res.status(500).json({ error: 'Invalid response from PayPal', details: rawText });
    }
    // Log raw PayPal response for debugging
    console.log('[PayPal] Raw order response:', JSON.stringify(orderData));
    if (!orderRes.ok) {
      // Log error details
      console.error('[PayPal] Order creation failed:', orderData);
      return res.status(500).json({ error: 'PayPal order creation failed', details: orderData });
    }
    if (!orderData.id) {
      console.error('[PayPal] No order ID in response:', orderData);
      return res.status(500).json({ error: 'No order ID in PayPal response', details: orderData });
    }
    const approvalUrl = (orderData.links || []).find(l => l.rel === 'approve')?.href;
    if (!approvalUrl) {
      console.error('[PayPal] No approval URL in response:', orderData);
      return res.status(500).json({ error: 'No approval URL in PayPal response', details: orderData });
    }
    res.status(200).json({ orderId: orderData.id, approvalUrl });
  } catch (err) {
    // Log error stack and details
    console.error('[PayPal] Exception during order creation:', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Failed to create PayPal order', details: err && err.message ? err.message : err });
  }
};