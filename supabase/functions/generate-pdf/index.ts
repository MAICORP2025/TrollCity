// Supabase Edge Function: Generate PDF from HTML
// Deploy to: supabase functions deploy generate-pdf

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { html } = await req.json()

    if (!html) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a simple PDF-like response
    // For production, integrate with a proper PDF library
    const encoder = new TextEncoder()
    const htmlBytes = encoder.encode(html)

    // Return as downloadable HTML that can be printed to PDF
    // In production, use a proper PDF generation service
    return new Response(
      JSON.stringify({
        success: true,
        message: 'PDF generation endpoint ready. Use client-side PDF library for production.',
        htmlLength: html.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
