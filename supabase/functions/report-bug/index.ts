import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface BugReportRequest {
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: 'broadcast' | 'auth' | 'database' | 'payment' | 'chat' | 'ui' | 'performance' | 'security' | 'other'
  error_message?: string
  stack_trace?: string
  affected_components?: string[]
  metadata?: Record<string, unknown>
  user_agent?: string
  page_url?: string
}

serve(async (req: Request) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    // Create Supabase client with admin privileges
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const body: BugReportRequest = await req.json()

    // Validate required fields
    if (!body.title || !body.description) {
      return new Response(JSON.stringify({ error: 'Title and description are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get user profile for username
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    // Insert the bug report
    const { data: bugAlert, error: insertError } = await supabaseAdmin
      .from('bug_alerts')
      .insert({
        title: body.title,
        description: body.description,
        severity: body.severity || 'medium',
        category: body.category || 'other',
        error_message: body.error_message,
        stack_trace: body.stack_trace,
        affected_components: body.affected_components || [],
        metadata: body.metadata || {},
        user_agent: body.user_agent,
        page_url: body.page_url,
        reported_by: user.id,
        reported_by_username: profile?.username,
        status: 'active'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting bug alert:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to create bug alert' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log(`[BugAlert] Bug report created: ${bugAlert.id} by ${user.id}`)

    return new Response(JSON.stringify({ 
      success: true,
      bug_alert_id: bugAlert.id
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error processing bug report:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
