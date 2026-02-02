import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixSupportTickets() {
  console.log('\n=== FIXING SUPPORT TICKETS TABLE ===\n')

  try {
    console.log('Verifying table structure...')
    
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .limit(1)

    if (error) {
      console.log('Error:', error.message)
    } else {
      console.log('✅ Table accessible')
      console.log('Columns:', data?.length ? Object.keys(data[0]) : 'empty')
    }

  } catch (error) {
    console.error('Error:', error)
  }

  console.log('\n=== DONE ===\n')
}

fixSupportTickets()
