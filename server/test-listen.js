const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const findConfig = require('find-config');
dotenv.config({ path: findConfig('.env') });

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server with explicit error handling
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on http://0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error('❌ Server listener error:', {
    code: err.code,
    message: err.message,
    errno: err.errno,
  });
  process.exit(1);
});

server.on('connection', (socket) => {
  console.log('📡 New connection established');
  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });
});
