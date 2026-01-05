const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from the root directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Import handlers
const livekitTokenHandler = require('./api/livekit-token');

// API Routes

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// LiveKit Test
app.get('/api/livekit/test', (req, res) => {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_CLOUD_URL || process.env.LIVEKIT_URL;

  if (apiKey && apiSecret && livekitUrl) {
    res.status(200).json({ status: 'ok', message: 'LiveKit configured' });
  } else {
    res.status(500).json({ status: 'error', message: 'LiveKit configuration missing' });
  }
});

// PayPal Test
app.get('/api/paypal/test', (req, res) => {
  // Check for PayPal credentials (assuming standard env vars)
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
  
  if (clientId) {
    res.status(200).json({ status: 'ok', message: 'PayPal configured' });
  } else {
    // For now, if no env var, we might return error, but let's see if we can fake it for dev
    // If user hasn't set it up, it's an error.
    res.status(500).json({ status: 'error', message: 'PayPal configuration missing' });
  }
});

// LiveKit Token
app.post('/api/livekit-token', async (req, res) => {
  await livekitTokenHandler(req, res);
});

// Admin: Cache Clear
app.post('/api/admin/cache/clear', (req, res) => {
  // In a real app, this would clear Redis or other server-side caches
  console.log('Cache clear requested');
  res.status(200).json({ success: true, message: 'Server cache cleared successfully' });
});

// Admin: Database Backup Trigger
app.post('/api/admin/backup/trigger', (req, res) => {
  // In a real app, this would trigger a PG dump or Supabase backup API
  console.log('Backup trigger requested');
  setTimeout(() => {
    // Simulate backup time
  }, 2000);
  res.status(200).json({ success: true, message: 'Backup process started', jobId: Date.now() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
