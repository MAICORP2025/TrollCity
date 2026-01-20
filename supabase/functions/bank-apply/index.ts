import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
        status: 200, 
        headers: {
            ...corsHeaders,
            // Explicitly allow all headers to avoid issues with custom headers like x-client-info
            "Access-Control-Allow-Headers": "*",
        }
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { requested_coins } = await req.json()

    if (!requested_coins) {
         return new Response(JSON.stringify({ error: 'Missing requested_coins' }), { status: 400, headers: corsHeaders })
    }

    const { data, error } = await supabaseClient.rpc('troll_bank_apply_for_loan', {
        p_user_id: user.id,
        p_requested_coins: requested_coins
    })

    if (error) throw error

    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabaseAdmin.from('bank_audit_log').insert({
        action: 'loan_application',
        performed_by: user.id,
        target_user_id: user.id,
        details: { requested_coins, result: data }
    })

    return new Response(JSON.stringify(data), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
