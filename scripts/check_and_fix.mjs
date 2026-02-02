
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function main() {
  console.log('--- Starting Check and Fix ---')

  // 1. Check Schema via RPC (if exec_sql exists)
  console.log('\n1. Checking Schema...')
  const { data: schemaData, error: schemaError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('user_cars', 'vehicles_catalog', 'user_vouchers') 
      AND column_name IN ('car_id', 'vehicle_id', 'id', 'slug', 'item_id');
    `
  })

  if (schemaError) {
    console.log('RPC exec_sql failed, trying direct inspection via Postgrest if possible (unlikely for schema)...')
    console.error('RPC Error:', schemaError.message)
  } else {
    console.log('Schema Info:', JSON.stringify(schemaData, null, 2))
  }

  // Check function definition
  const { data: funcData, error: funcError } = await supabase.rpc('exec_sql', {
    sql: `select prosrc from pg_proc where proname = 'handle_new_user_credit';`
  })
  
  if (!funcError) {
      console.log('handle_new_user_credit source:', JSON.stringify(funcData, null, 2))
  }

  // 2. Check for Orphaned Users
  console.log('\n2. Checking for Orphaned Users...')
  
  // List all users (pagination might be needed for large DBs, but start simple)
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  
  if (listError) {
    console.error('Error listing users:', listError)
    return
  }

  console.log(`Found ${users.length} users in auth.users`)

  let orphansFound = 0
  
  for (const user of users) {
    // Check if profile exists
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      console.log(`\n[ORPHAN DETECTED] User: ${user.email} (ID: ${user.id})`)
      console.log('  -> No profile found in user_profiles.')
      orphansFound++

      // Delete the orphan
      console.log(`  -> Deleting orphaned user...`)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
      
      if (deleteError) {
        console.error(`  -> Failed to delete: ${deleteError.message}`)
      } else {
        console.log(`  -> Successfully deleted.`)
      }
    }
  }

  if (orphansFound === 0) {
    console.log('\nNo orphaned users found.')
  } else {
    console.log(`\nCleaned up ${orphansFound} orphaned users.`)
  }

  console.log('\n--- Done ---')
}

main()
