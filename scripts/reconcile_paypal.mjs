import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Polyfill fetch if needed (Node 18+ has it native)
const _fetch = global.fetch || (await import('node-fetch')).default

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env vars from .env.local
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env.local')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      content.split('\n').forEach(line => {
        const [key, value] = line.split('=')
        if (key && value) {
          process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '')
        }
      })
    }
  } catch {
    console.warn('Could not load .env.local')
  }
}

loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_BASE = process.env.PAYPAL_MODE === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.error('Missing required environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function getPayPalToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
  const res = await _fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })
  
  if (!res.ok) throw new Error(`PayPal Token Error: ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

async function getOrderDetails(orderId, token) {
  const res = await _fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  
  if (!res.ok) throw new Error(`PayPal Order Error: ${await res.text()}`)
  return await res.json()
}

async function reconcileOrder(orderId) {
  console.log(`\n🔍 Reconciling Order: ${orderId}`)
  
  try {
    // 1. Check if already exists
    const { data: existing } = await supabase
      .from('coin_transactions')
      .select('id, status')
      .or(`paypal_order_id.eq.${orderId},external_id.eq.${orderId}`)
      .maybeSingle()
      
    if (existing) {
      console.log(`✅ Transaction already exists: ${existing.id} (${existing.status})`)
      return
    }
    
    // 2. Fetch from PayPal
    console.log('Fetching from PayPal...')
    const token = await getPayPalToken()
    const order = await getOrderDetails(orderId, token)
    
    if (order.status !== 'COMPLETED') {
      console.log(`❌ Order status is ${order.status}, cannot reconcile.`)
      return
    }
    
    const purchaseUnit = order.purchase_units[0]
    const capture = purchaseUnit.payments?.captures?.[0]
    
    if (!capture || capture.status !== 'COMPLETED') {
      console.log('❌ No completed capture found in order.')
      return
    }
    
    // 3. Extract Metadata
    const customId = purchaseUnit.custom_id
    if (!customId) {
      console.log('❌ Missing custom_id (metadata) in PayPal order.')
      return
    }
    
    let userId, coins
    if (customId.includes('|')) {
      [userId, coins] = customId.split('|')
      coins = parseInt(coins, 10)
    } else {
      try {
        const json = JSON.parse(customId)
        userId = json.userId || json.user_id
        coins = Number(json.coins)
      } catch {
        console.log('❌ Failed to parse custom_id')
        return
      }
    }
    
    if (!userId || !coins) {
      console.log('❌ Invalid metadata extracted.')
      return
    }
    
    const amountPaid = Number(capture.amount?.value || purchaseUnit.amount?.value)
    
    console.log(`📝 Processing: User ${userId}, Coins ${coins}, Paid $${amountPaid}`)
    
    // 4. Insert Transaction
    const { data: tx, error: txError } = await supabase
      .from('coin_transactions')
      .insert({
        user_id: userId,
        amount: coins,
        type: 'purchase',
        description: `PayPal Reconcile ${orderId}`,
        source: 'paypal_reconcile',
        external_id: capture.id,
        paypal_order_id: orderId,
        platform_profit: amountPaid,
        coin_type: 'paid',
        status: 'completed',
        metadata: {
          ...order,
          reconciled_at: new Date().toISOString()
        }
      })
      .select()
      .single()
      
    if (txError) {
      console.error('❌ Insert Error:', txError)
      return
    }
    
    console.log(`✅ Transaction inserted: ${tx.id}`)
    
    // 5. Update Balance
    // Using RPC if available, or manual
    const { error: rpcError } = await supabase.rpc('add_troll_coins', {
      user_id_input: userId,
      coins_to_add: coins
    })
    
    if (rpcError) {
      console.log('⚠️ RPC failed, trying manual update...', rpcError.message)
      const { data: profile } = await supabase.from('user_profiles').select('troll_coins').eq('id', userId).single()
      const current = profile?.troll_coins || 0
      
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ troll_coins: current + coins })
        .eq('id', userId)
        
      if (updateError) {
        console.error('❌ Balance Update Error:', updateError)
      } else {
        console.log('✅ Balance updated manually.')
      }
    } else {
      console.log('✅ Balance updated via RPC.')
    }
    
  } catch (e) {
    console.error('❌ Unexpected Error:', e.message)
  }
}

// Run if called directly with args
const args = process.argv.slice(2)
if (args.length > 0) {
  for (const id of args) {
    await reconcileOrder(id)
  }
} else {
  console.log('Usage: node scripts/reconcile_paypal.mjs <order_id_1> <order_id_2> ...')
}
