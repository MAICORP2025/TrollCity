#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function getColumns(table) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('table_name,column_name,data_type,udt_name')
    .eq('table_schema', 'public')
    .eq('table_name', table)
  if (error) throw error
  return data
}

async function main() {
  try {
    const tables = ['user_inventory', 'shop_items', 'marketplace_items', 'shop_transactions', 'marketplace_purchases']
    for (const t of tables) {
      try {
        const cols = await getColumns(t)
        console.log(`\nTable: ${t}`)
        if (!cols || cols.length === 0) {
          console.log('  No columns found (table may not exist)')
        } else {
          for (const c of cols) {
            console.log(`  ${c.column_name}: ${c.data_type} (${c.udt_name})`)
          }
        }
      } catch (e) {
        console.log(`\nTable: ${t}`)
        console.log('  Error fetching columns:', e.message)
      }
    }
  } catch (e) {
    console.error('Debug failed:', e)
    process.exit(1)
  }
}

main()
