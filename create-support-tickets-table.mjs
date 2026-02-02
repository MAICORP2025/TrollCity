import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

async function createSupportTicketsTable() {
  console.log('\n=== CREATING SUPPORT TICKETS TABLE ===\n')

  try {
    const createTableSQL = `
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  email text,
  subject text,
  category text DEFAULT 'general',
  message text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
`

    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL })
    
    if (error) {
      console.log('Note:', error.message)
      console.log('\n📋 Please run the SQL manually in Supabase SQL Editor')
    } else {
      console.log('✅ Table created successfully!')
    }

  } catch (error) {
    console.error('Error:', error.message)
  }

  console.log('\n=== DONE ===\n')
}

createSupportTicketsTable()
