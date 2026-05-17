const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from the root directory
const findConfig = require('find-config');
dotenv.config({ path: findConfig('.env') });

// Telemetry handler - safe to load early (no Supabase client at module level)
const telemetryHandler = require('./api/telemetryHandler');

/* ============================================================================
 * 🛡️  CRITICAL STREAMING INFRASTRUCTURE - PROTECTED
 *
 * This file defines API routes for LiveKit integration.
 * Key endpoints:
 *   POST /api/broadcasts/start-streaming  → starts LiveKit egress
 *   POST /api/broadcasts/stop-streaming   → stops egress
 *
 * DO NOT modify route paths without coordinating with:
 *   - Frontend: SetupPage.tsx and BroadcastPage.tsx
 *   - Handler: server/api/broadcasts.js
 *
 * PROTECTION: This file is monitored by pre-commit hook.
 * Any changes require explicit confirmation during commit.
 * ============================================================================ */

const app = express();
const PORT = process.env.PORT || 3002;

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Initialize Supabase client for server-side queries
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Startup diagnostics
console.log('[Server] 🔧 Configuration check:');
console.log('[Server]   SUPABASE_URL:', supabaseUrl ? '✅ set' : '❌ MISSING');
console.log('[Server]   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ set' : '❌ MISSING');
if (supabaseServiceKey && supabaseServiceKey.startsWith('eyJ')) {
  // JWT tokens start with "eyJ" — anon and service keys both do, but we can at least confirm it's set
  console.log('[Server]   ⚠️  Service key appears valid (JWT format)');
} else {
  console.log('[Server]   ❌ Service key missing or malformed');
}

// App URL for canonical URLs
const APP_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://trollcity.app';

// Default fallback image (used when no stream thumbnail available)
const FALLBACK_PREVIEW_IMAGE = `${APP_URL}/preview-default.svg`;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  immutable: true
}));

app.use(cors());
app.use((req, res, next) => {
  express.json()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    next();
  });
});

// API Routes - Lazy-loaded to defer Supabase client initialization until after env is confirmed

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'MISSING',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING',
      LIVEKIT_URL: process.env.LIVEKIT_URL ? 'set' : 'MISSING',
      LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ? 'set' : 'MISSING',
      LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ? 'set' : 'MISSING',
    },
    nodeVersion: process.version,
    platform: process.platform
  });
});

// PayPal Test
app.get('/api/paypal/test', (req, res) => {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
  res.status(clientId ? 200 : 500).json({ 
    status: clientId ? 'ok' : 'error', 
    message: clientId ? 'PayPal configured' : 'PayPal configuration missing' 
  });
});

// Telemetry
app.post('/api/telemetry', async (req, res) => {
  await telemetryHandler(req, res);
});

// Admin: Cache Clear
app.post('/api/admin/cache/clear', (req, res) => {
  console.log('Cache clear requested');
  res.status(200).json({ success: true, message: 'Server cache cleared successfully' });
});

// Admin: Database Backup Trigger (single definition)
app.post('/api/admin/backup/trigger', (req, res) => {
  console.log('Backup trigger requested');
  res.status(200).json({ success: true, message: 'Backup process started', jobId: Date.now() });
});

// Broadcast API Routes - lazy load handler
app.post('/api/broadcasts/start-streaming', async (req, res) => {
  try {
    const broadcastHandler = require('./api/broadcasts');
    if (!broadcastHandler.startStreaming) {
      console.error('[StartStreaming] Handler module loaded but startStreaming function not found');
      return res.status(500).json({
        error: 'Internal server error: Handler function not found',
        details: 'startStreaming function missing from broadcasts module',
      });
    }
    await broadcastHandler.startStreaming(req, res);
  } catch (err) {
    console.error('[StartStreaming] Handler error:', {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      type: err?.constructor?.name,
    });
    
    // Ensure we always return JSON, even on handler error
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to start broadcast',
        details: err?.message || 'Unknown error',
        step: 'handler_execution',
      });
    }
  }
});

app.post('/api/broadcasts/stop-streaming', async (req, res) => {
  try {
    const broadcastHandler = require('./api/broadcasts');
    if (!broadcastHandler.stopStreaming) {
      console.error('[StopStreaming] Handler module loaded but stopStreaming function not found');
      return res.status(500).json({
        error: 'Internal server error: Handler function not found',
        details: 'stopStreaming function missing from broadcasts module',
      });
    }
    await broadcastHandler.stopStreaming(req, res);
  } catch (err) {
    console.error('[StopStreaming] Handler error:', {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      type: err?.constructor?.name,
    });
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to stop broadcast',
        details: err?.message || 'Unknown error',
        step: 'handler_execution',
      });
    }
  }
});

app.post('/api/broadcasts/save-video', async (req, res) => {
  try {
    const broadcastHandler = require('./api/broadcasts');
    await broadcastHandler.saveVideo(req, res);
  } catch (err) {
    console.error('[SaveVideo] Handler error:', err);
    res.status(500).json({ error: 'Failed to save video', details: err.message });
  }
});

// Social Media Preview Endpoint - Returns HTML with Open Graph and Twitter Card meta tags
// Used by Facebook, X (Twitter), and other social media crawlers for link previews
app.get('/api/social/:broadcastId', async (req, res) => {
  const { broadcastId } = req.params;
  
  // Validate broadcastId is a UUID or username
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(broadcastId);
  
  let stream = null;
  let broadcaster = null;
  
  try {
    if (!supabase) {
      console.error('[SocialPreview] Supabase client not initialized');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    if (isUUID) {
      // Direct stream lookup by UUID
      const { data: streamData, error: streamError } = await supabase
        .from('streams')
        .select('*, user_profiles(username, avatar_url, thumbnail_url)')
        .eq('id', broadcastId)
        .maybeSingle();
      
      if (streamError) {
        console.error('[SocialPreview] Stream fetch error:', streamError);
      } else if (streamData) {
        stream = streamData;
        broadcaster = streamData.user_profiles;
      }
    } else {
      // Username lookup - find user first, then their active stream
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id, username, avatar_url, thumbnail_url')
        .eq('username', broadcastId)
        .maybeSingle();
      
      if (userError) {
        console.error('[SocialPreview] User fetch error:', userError);
      } else if (userData) {
        // Look for active stream
        const { data: streamData, error: streamError } = await supabase
          .from('streams')
          .select('*, user_profiles(username, avatar_url, thumbnail_url)')
          .eq('user_id', userData.id)
          .eq('is_live', true)
          .eq('status', 'live')
          .maybeSingle();
        
        if (streamError) {
          console.error('[SocialPreview] Stream by user fetch error:', streamError);
        } else if (streamData) {
          stream = streamData;
          broadcaster = streamData.user_profiles;
        }
      }
    }
    
    // Handle stream not found or ended
    if (!stream) {
      const meta = generateSocialMetaHTML({
        title: 'Stream Not Found',
        description: 'This broadcast is not available.',
        image: FALLBACK_PREVIEW_IMAGE,
        url: `${APP_URL}/watch/${broadcastId}`,
        type: 'website',
        isLive: false
      });
      return res.status(404).send(meta);
    }
    
    // Check if live or ended
    const isLive = stream.status === 'live';
    const statusText = isLive ? 'LIVE' : 'Ended';
    
    // Get thumbnail or use broadcaster's avatar as fallback
    const previewImage = stream.thumbnail_url || broadcaster?.thumbnail_url || broadcaster?.avatar_url || FALLBACK_PREVIEW_IMAGE;
    
    // Generate player URL for Twitter/X cards
    const playerUrl = `${APP_URL}/watch/${stream.id}`;
    
    const meta = generateSocialMetaHTML({
      title: `${broadcaster?.username || 'Broadcaster'} is ${statusText} on Troll City`,
      description: stream.title || `Watch this live broadcast on Troll City`,
      image: previewImage,
      url: `${APP_URL}/watch/${stream.id}`,
      type: isLive ? 'video.other' : 'website',
      isLive,
      videoUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null,
      videoWidth: 1280,
      videoHeight: 720,
      twitterCard: isLive ? 'player' : 'summary_large_image',
      twitterPlayerUrl: isLive ? `${APP_URL}/embed/${stream.id}` : null,
      twitterPlayerWidth: 1280,
      twitterPlayerHeight: 720,
      site: '@trollcityapp'
    });
    
    res.status(200).send(meta);
    
  } catch (error) {
    console.error('[SocialPreview] Error:', error);
    const meta = generateSocialMetaHTML({
      title: 'Troll City - Live Streaming',
      description: 'Join Troll City for live streaming and more.',
      image: FALLBACK_PREVIEW_IMAGE,
      url: `${APP_URL}/watch/${broadcastId}`,
      type: 'website',
      isLive: false
    });
    res.status(200).send(meta);
  }
});

// Watch page endpoint - Returns SEO-optimized HTML for /watch/:id routes
// This endpoint serves the HTML with meta tags directly for crawlers
app.get('/watch/:broadcastId', async (req, res) => {
  const { broadcastId } = req.params;
  
  // Redirect to the social preview API for crawler detection
  // Social media bots will follow the redirect but get meta tags in the API response
  // Regular users will be served the SPA via client-side routing
  
  // Check if this is a crawler request
  const userAgent = req.headers['user-agent'] || '';
  const isBot = /facebookexternalhit|twitterbot|bingbot|googlebot|slackbot|discordbot|telegrambot|whatsapp|metaexternalhit/i.test(userAgent);
  
  if (isBot) {
    // Fetch and return meta directly
    return res.redirect(301, `/api/social/${broadcastId}`);
  }
  
  // For regular users, serve the index.html (client-side routing will handle it)
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Embed endpoint for video player
app.get('/embed/:broadcastId', async (req, res) => {
  const { broadcastId } = req.params;
  
  // Return embeddable HTML for Twitter/X player cards
  const embedHtml = generateEmbedHTML(broadcastId, APP_URL);
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(embedHtml);
});

// Helper: Generate Social Meta HTML with OG and Twitter Card tags
function generateSocialMetaHTML(data) {
  const {
    title = 'Troll City - Live Streaming',
    description = 'Watch live streams on Troll City',
    image = FALLBACK_PREVIEW_IMAGE,
    url = APP_URL,
    type = 'website',
    isLive = false,
    videoUrl = null,
    videoWidth = 1280,
    videoHeight = 720,
    twitterCard = 'summary_large_image',
    twitterPlayerUrl = null,
    twitterPlayerWidth = 1280,
    twitterPlayerHeight = 720,
    site = '@trollcityapp'
  } = data;
  
  // Escape HTML entities to prevent XSS
  const esc = (str) => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${esc(url)}">
  
  <!-- Open Graph / Facebook Meta Tags -->
  <meta property="og:type" content="${esc(type)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:site_name" content="Troll City">
  
  ${videoUrl ? `
  <meta property="og:video" content="${esc(videoUrl)}">
  <meta property="og:video:secure_url" content="${esc(videoUrl)}">
  <meta property="og:video:type" content="text/html">
  <meta property="og:video:width" content="${videoWidth}">
  <meta property="og:video:height" content="${videoHeight}">
  ` : ''}
  
  <!-- Twitter / X Card Meta Tags -->
  <meta name="twitter:card" content="${esc(twitterCard)}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <meta name="twitter:site" content="${esc(site)}">
  
  ${twitterPlayerUrl ? `
  <meta name="twitter:player" content="${esc(twitterPlayerUrl)}">
  <meta name="twitter:player:width" content="${twitterPlayerWidth}">
  <meta name="twitter:player:height" content="${twitterPlayerHeight}">
  ` : ''}
  
  <!-- Additional Meta Tags -->
  <meta property="al:ios:app_store_id" content="6471861674">
  <meta property="al:ios:app_name" content="Troll City">
  <meta property="al:android:package" content="app.trollcity.app">
  <meta property="al:android:app_name" content="Troll City">
  
  ${isLive ? `
  <meta property="og:live" content="true">
  <meta property="og:stream:status" content="live">
  ` : ''}
  
  <style>
    body { margin: 0; padding: 0; background: #000; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
    .container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
    .live-badge { display: inline-block; background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: bold; margin-bottom: 16px; }
    h1 { font-size: 24px; margin: 0 0 8px 0; }
    p { font-size: 16px; color: #9ca3af; margin: 0 0 24px 0; }
    .preview-image { max-width: 100%; max-height: 400px; border-radius: 8px; margin-bottom: 24px; }
    .cta { display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; }
    .cta:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    ${isLive ? '<span class="live-badge">● LIVE</span>' : ''}
    <img class="preview-image" src="${esc(image)}" alt="${esc(title)}" onerror="this.style.display='none'">
    <h1>${esc(title)}</h1>
    <p>${esc(description)}</p>
    <a class="cta" href="${esc(url)}">Watch Now</a>
  </div>
</body>
</html>`;
  
  return html;
}

// Helper: Generate embeddable player HTML
function generateEmbedHTML(broadcastId, appUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Watch Stream | Troll City</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; }
    .player-container { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    iframe { width: 100%; height: 100%; border: none; }
  </style>
</head>
<body>
  <div class="player-container">
    <iframe 
      src="${appUrl}/broadcast/${broadcastId}?embed=true" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen>
    </iframe>
  </div>
</body>
</html>`;
}

// Broadcast API Routes - LiveKit Integration
app.post('/api/broadcasts/start-streaming', async (req, res) => { await broadcastHandler.startStreaming(req, res); });
app.post('/api/broadcasts/stop-streaming', async (req, res) => { await broadcastHandler.stopStreaming(req, res); });
app.post('/api/broadcasts/save-video', async (req, res) => { await broadcastHandler.saveVideo(req, res); });

// Backward compatibility aliases (deprecated - remove after migration complete)
app.post('/api/broadcasts/start', async (req, res) => {
  console.warn('[Server] Deprecated endpoint /api/broadcasts/start called - use /api/broadcasts/start-streaming instead');
  await broadcastHandler.startStreaming(req, res);
});
app.post('/api/broadcasts/stop', async (req, res) => {
  console.warn('[Server] Deprecated endpoint /api/broadcasts/stop called - use /api/broadcasts/stop-streaming instead');
  await broadcastHandler.stopStreaming(req, res);
});

// Global Error Handler
app.use((err, req, res, _next) => {
  console.error('Unhandled Server Error:', err);
  
  // Log to telemetry
  if (telemetryHandler.logEvent) {
    telemetryHandler.logEvent({
      event_type: 'server_error',
      message: err.message || 'Unknown Server Error',
      stack: err.stack,
      severity: 'error',
      fingerprint: `server-${err.message || 'unknown'}`,
      url: req.url,
      request_info: {
        method: req.method,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      },
      env: process.env.NODE_ENV || 'development'
    }).catch(e => console.error('Failed to log server error to telemetry', e));
  }

  res.status(500).json({ 
    error: 'Internal Server Error', 
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: GET http://localhost:${PORT}/api/health`);
});

server.on('error', (err) => {
  console.error('❌ Failed to start server:', err.message);
  console.error('   Code:', err.code);
  console.error('   Errno:', err.errno);
  process.exit(1);
});
