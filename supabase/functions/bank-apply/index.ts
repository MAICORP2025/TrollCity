import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body;
    try {
        body = await req.json()
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders })
    }

    const coins = body.amount || body.requested_coins
    if (!coins) {
         return new Response(JSON.stringify({ error: 'Missing amount' }), { status: 400, headers: corsHeaders })
    }

    // Determine if Service Role or User
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const isServiceCall = serviceRoleKey && authHeader.includes(serviceRoleKey);
    
    let supabaseClient;
    let userId;

    if (isServiceCall) {
        userId = body.user_id || body.p_user_id;
        if (!userId) {
            return new Response(JSON.stringify({ error: 'Missing user_id for service call' }), { status: 400, headers: corsHeaders })
        }
        supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            serviceRoleKey ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )
    } else {
        supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } }
        )
        
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) {
            console.error('Auth error:', authError)
            return new Response(JSON.stringify({ error: 'Unauthorized', details: authError?.message }), { status: 401, headers: corsHeaders });
        }
        userId = user.id
    }

    // Call the RPC
    const { data, error } = await supabaseClient.rpc('troll_bank_apply_for_loan', {
        p_user_id: userId,
        p_requested_coins: coins
    })

    if (error) {
      console.error('RPC Error:', error)
      return new Response(JSON.stringify({ error: error.message || 'Loan application failed' }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Check if the RPC returned a logical error structure
    if (data && data.success === false) {
       return new Response(JSON.stringify({ error: data.reason || data.message || 'Loan application denied', data }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Audit Log (using Service Role)
    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabaseAdmin.from('bank_audit_log').insert({
            action: 'loan_application',
            performed_by: userId,
            target_user_id: userId,
            details: { requested_coins: coins, result: data, via_service: isServiceCall }
        })
    } catch (auditError) {
        console.error('Audit log error:', auditError)
        // Don't fail the request if audit fails
    }

    return new Response(JSON.stringify(data), { headers: corsHeaders })
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
