// Add Card Edge Function
// TROLL BANK OVERRIDE: External payments are disabled
// This function previously vaulted cards with Square, but is now disabled in favor of Troll Bank Loans.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { withCors, handleCorsPreflight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const requestId = `add_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[AddCard ${requestId}] Request received:`, {
    method: req.method,
    url: req.url,
  })

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight()
  }

  if (req.method !== 'POST') {
    return withCors({ success: false, error: 'Method not allowed' }, 405)
  }

  // TROLL BANK OVERRIDE: External payments are disabled
  console.log(`[AddCard ${requestId}] ⛔ Blocked request - External payments disabled`)
  return withCors({ 
    success: false, 
    error: 'External payments are disabled. Please use Troll Bank Loans.' 
  }, 403)
})
