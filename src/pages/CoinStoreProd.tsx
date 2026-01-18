// src/pages/CoinStoreProd.tsx
// Production-ready PayPal coin purchase component with centralized fulfillment
import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Loader2, AlertCircle, CheckCircle, Coins, Wallet } from 'lucide-react'

// Test function for debugging - call from browser console:
// window.testPayPalFulfillment('YOUR_ORDER_ID')
declare global {
  interface Window {
    testPayPalFulfillment: (orderId: string) => Promise<void>;
    paypal?: {
      Buttons?: (config: any) => { render: (selector: string) => void };
    };
  }
}

interface CoinPackage {
  id: string
  name: string
  coins: number
  price_usd: number
  paypal_sku: string
  is_active: boolean
}

interface FulfillResponse {
  success: boolean
  orderId: string
  captureId?: string
  coinsAdded?: number
  usdAmount?: number
  error?: string
  errorCode?: string
  requiresManualIntervention?: boolean
}

// Coin package data (mirrors database)
const COIN_PACKAGES: CoinPackage[] = [
  { id: '1', name: 'Bronze Pack', coins: 1000, price_usd: 4.49, paypal_sku: 'coins_1000', is_active: true },
  { id: '2', name: 'Silver Pack', coins: 5000, price_usd: 20.99, paypal_sku: 'coins_5000', is_active: true },
  { id: '3', name: 'Gold Pack', coins: 12000, price_usd: 49.99, paypal_sku: 'coins_12000', is_active: true },
  { id: '4', name: 'Platinum Pack', coins: 25000, price_usd: 99.99, paypal_sku: 'coins_25000', is_active: true },
  { id: '5', name: 'Diamond Pack', coins: 60000, price_usd: 239.99, paypal_sku: 'coins_60000', is_active: true },
  { id: '6', name: 'Legendary Pack', coins: 120000, price_usd: 459.99, paypal_sku: 'coins_120000', is_active: true },
]

interface PayPalButtonsProps {
  selectedPackage: CoinPackage | null
  onApprove: (details: { orderId: string; packageId?: string; captureResponse?: Record<string, unknown> }) => Promise<void>
}

const PayPalButtonsWrapper: React.FC<PayPalButtonsProps> = ({ selectedPackage, onApprove }) => {
  const [_isProcessing, setIsProcessing] = useState(false)
  const { user } = useAuthStore()

  useEffect(() => {
    if (!window.paypal || !selectedPackage || !user) return

    // Cleanup previous buttons
    const container = document.getElementById('paypal-button-container')
    if (container) {
      container.innerHTML = ''
    }

    // Type-safe access to PayPal
    const paypal = window.paypal
    if (!paypal || !paypal.Buttons) {
      console.error('PayPal SDK not fully loaded')
      return
    }
    
    paypal
      .Buttons({
        createOrder: async () => {
          try {
            setIsProcessing(true)

            // Call edge function to create PayPal order
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-create-order`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                },
                body: JSON.stringify({
                  amount: selectedPackage.price_usd,
                  coins: selectedPackage.coins,
                  user_id: user.id,
                  package_id: selectedPackage.id,
                }),
              }
            )

            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.error || 'Failed to create order')
            }

            const data = await response.json()
            return data.orderId
          } catch (error) {
            console.error('Create order error:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to create order')
            throw error
          } finally {
            setIsProcessing(false)
          }
        },
        onApprove: async (data: any, actions: any) => {
          try {
            setIsProcessing(true)
            console.log("🔍 onApprove data:", data)
            console.log("🔍 data.orderID:", data.orderID)
            
            if (!data.orderID) {
              console.error("❌ Missing PayPal orderID in onApprove data:", data)
              throw new Error('Missing order ID from PayPal')
            }
            
            // Capture the order on PayPal's side first
            const captureResult = await actions.order.capture()
            console.log("✅ PayPal capture success:", captureResult)
            
            // Call the new centralized fulfillment Edge Function
            // This handles: coin crediting, dashboard updates, and logging
            await onApprove({
              orderId: data.orderID,
              packageId: selectedPackage?.id,
              captureResponse: captureResult
            })
          } catch (error: any) {
            console.error('Approval error:', error)
            
            // PayPal recommends restarting checkout for INSTRUMENT_DECLINED
            if (error?.details?.[0]?.issue === 'INSTRUMENT_DECLINED') {
              console.log('💳 Payment instrument declined, restarting checkout...')
              toast.info('Payment method declined. Please try a different payment method.')
              return actions.restart()
            }
            
            toast.error(error instanceof Error ? error.message : 'Payment approval failed')
          } finally {
            setIsProcessing(false)
          }
        },
        onCancel: (data: any) => {
          console.log('PayPal checkout cancelled:', data)
          toast.info('Payment cancelled')
        },
        onError: (error: any) => {
          console.error('PayPal error:', error)
          
          // Handle INSTRUMENT_DECLINED in onError as well
          if (error?.details?.[0]?.issue === 'INSTRUMENT_DECLINED') {
            console.log('💳 Payment instrument declined in onError')
            toast.info('Payment method declined. Please try a different payment method.')
          } else {
            toast.error('PayPal payment failed. Please refresh and try again.')
          }
        },
      })
      .render('#paypal-button-container')
  }, [selectedPackage, user, onApprove])

  if (!selectedPackage || !user) {
    return <div className="text-gray-400">Please select a package</div>
  }

  return (
    <div className="mt-4">
      <div id="paypal-button-container"></div>
    </div>
  )
}

export default function CoinStoreProd() {
  const { user, profile, setProfile } = useAuthStore()
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null)
  const [_isProcessing, setIsProcessing] = useState(false)
  const [packages, setPackages] = useState<CoinPackage[]>(COIN_PACKAGES)
  const [customCoins, setCustomCoins] = useState<number | ''>('')
  const [transactionStatus, _setTransactionStatus] = useState<{
    status: 'idle' | 'processing' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })

  const setTransactionStatus = (status: typeof transactionStatus) => {
    _setTransactionStatus(status)
  }

  // Inject PayPal script
  useEffect(() => {
    const script = document.createElement('script')
    script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&currency=USD&intent=capture`
    script.async = true
    script.onload = () => {
      console.log('✅ PayPal SDK loaded')
    }
    script.onerror = () => {
      console.error('❌ Failed to load PayPal SDK')
    }
    document.head.appendChild(script)
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [])

  // Load packages from database
  useEffect(() => {
    const loadPackages = async () => {
      try {
        const { data, error } = await supabase
          .from('coin_packages')
          .select('*')
          .eq('is_active', true)
          .order('price_usd', { ascending: true })

        if (error) throw error
        if (data) {
          setPackages(data)
        }
      } catch (error) {
        console.error('Failed to load packages:', error)
        // Fall back to hardcoded packages
      }
    }

    loadPackages()
  }, [])

  const handlePayPalApprove = async (approveData: {
    orderId: string
    packageId?: string
    captureResponse?: Record<string, unknown>
  }) => {
    console.log("✅ PayPal Approved - processing fulfillment:", JSON.stringify(approveData, null, 2))
    
    const { orderId, packageId, captureResponse } = approveData
    
    if (!orderId) {
      console.error("❌ Missing orderId in handlePayPalApprove:", approveData)
      toast.error('Order ID missing - PayPal integration incomplete')
      return
    }
    
    if (!selectedPackage || !user) {
      toast.error('Invalid transaction state')
      return
    }

    try {
      setTransactionStatus({ status: 'processing', message: 'Processing payment and crediting coins...' })
      setIsProcessing(true)

      // Get current auth token
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (!token) {
        throw new Error('Not authenticated')
      }

      // Call the centralized fulfillment Edge Function
      // This handles: idempotency, coin crediting, dashboard updates, and logging
      const fulfillResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fulfill-paypal-purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: orderId,
            packageId: packageId || selectedPackage.id,
            userId: user.id,
            captureResponse: captureResponse
          }),
        }
      )

      // Safely parse response
      const responseText = await fulfillResponse.text()
      let fulfillData: FulfillResponse
      
      try {
        fulfillData = JSON.parse(responseText) as FulfillResponse
      } catch {
        console.error("❌ Non-JSON response from fulfillment function:", responseText)
        if (!fulfillResponse.ok) {
          throw new Error('Payment processing failed. Please try again.')
        }
        throw new Error('Invalid response from server')
      }

      if (!fulfillResponse.ok) {
        throw new Error(fulfillData.error || 'Payment fulfillment failed')
      }

      if (!fulfillData.success) {
        // Handle partial success / requires manual intervention
        if (fulfillData.requiresManualIntervention) {
          console.warn("⚠️ Payment succeeded but coin credit requires manual intervention:", fulfillData)
          setTransactionStatus({
            status: 'error',
            message: 'Payment completed but coins are delayed. Support has been notified.',
          })
          toast.error('Payment completed but coins are delayed. Support has been notified.')
          return
        }
        throw new Error(fulfillData.error || 'Payment fulfillment failed')
      }

      // Update local profile state with newly credited coins
      if (profile && fulfillData.coinsAdded) {
        setProfile({
          ...profile,
          troll_coins: (profile.troll_coins || 0) + fulfillData.coinsAdded,
        })
      }

      // Refresh profile from database to verify
      await new Promise(resolve => setTimeout(resolve, 1000))
      const { data: freshProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (freshProfile) {
        setProfile(freshProfile)
      }

      setTransactionStatus({
        status: 'success',
        message: `Successfully credited ${fulfillData.coinsAdded?.toLocaleString() || 0} coins!`,
      })

      toast.success(`+${fulfillData.coinsAdded?.toLocaleString() || 0} coins credited to your account!`)

      // Reset selection after 3 seconds
      setTimeout(() => {
        setSelectedPackage(null)
        setTransactionStatus({ status: 'idle' })
      }, 3000)
    } catch (error) {
      console.error('Payment fulfillment error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed'

      setTransactionStatus({
        status: 'error',
        message: errorMessage,
      })

      toast.error(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  // Test function for debugging - call from browser console:
  // window.testPayPalFulfillment('YOUR_ORDER_ID')
  window.testPayPalFulfillment = async (orderId: string) => {
    console.log("🧪 Testing PayPal fulfillment with orderId:", orderId)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        console.error("❌ Not authenticated")
        return
      }
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fulfill-paypal-purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ orderId }),
        }
      )
      
      const text = await response.text()
      console.log("📥 Response status:", response.status)
      console.log("📥 Response body:", text)
      
      try {
        const json = JSON.parse(text)
        console.log("📥 Parsed response:", json)
      } catch {
        console.log("📥 Could not parse response as JSON")
      }
    } catch (error) {
      console.error("❌ Test error:", error)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0814] text-white p-6 flex items-center justify-center">
        <div className="bg-[#1A1A24] border border-gray-700 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
          <p>Please sign in to purchase coins</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <Coins className="w-8 h-8 text-purple-500" />
            Purchase Coins
          </h1>
          <p className="text-gray-400">
            Current balance: <span className="text-purple-400 font-semibold">{(profile?.troll_coins || 0).toLocaleString()}</span> coins
          </p>
        </div>

        {/* Status Messages */}
        {transactionStatus.status === 'processing' && (
          <div className="mb-6 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <p className="text-blue-200">{transactionStatus.message}</p>
          </div>
        )}

        {transactionStatus.status === 'success' && (
          <div className="mb-6 bg-green-900/20 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p className="text-green-200">{transactionStatus.message}</p>
          </div>
        )}

        {transactionStatus.status === 'error' && (
          <div className="mb-6 bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-200">{transactionStatus.message}</p>
          </div>
        )}

        {/* Coin Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg)}
              className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${
                selectedPackage?.id === pkg.id
                  ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/50'
                  : 'border-gray-700 bg-[#1A1A24] hover:border-purple-500/50'
              }`}
            >
              {/* Popular Badge */}
              {(pkg.price_usd === 49.99 || pkg.price_usd === 99.99) && (
                <div className="absolute -top-3 right-4 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  Popular
                </div>
              )}

              <h3 className="text-lg font-bold mb-2">{pkg.name}</h3>
              <div className="mb-4">
                <p className="text-3xl font-bold text-purple-400">{pkg.coins.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">coins</p>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-2xl font-bold">${pkg.price_usd.toFixed(2)}</p>
                <p className="text-gray-400 text-sm">
                  ${(pkg.price_usd / pkg.coins * 1000).toFixed(2)}/K
                </p>
              </div>

              {selectedPackage?.id === pkg.id && (
                <div className="mt-4 pt-4 border-t border-purple-500/50">
                  <p className="text-sm text-purple-300 font-semibold mb-3">Selected Package</p>
                </div>
              )}
            </div>
          ))}

          <div
            className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${
              selectedPackage?.id?.startsWith('custom_')
                ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/50'
                : 'border-dashed border-gray-700 bg-[#1A1A24] hover:border-purple-500/50'
            }`}
          >
            <h3 className="text-lg font-bold mb-2">Custom Amount</h3>
            <p className="text-sm text-gray-400 mb-3">
              Choose an exact number of coins. Price is based on 100 coins = $1.00.
            </p>
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Coins</label>
              <input
                type="number"
                min={100}
                step={100}
                value={customCoins === '' ? '' : customCoins}
                onChange={(e) => {
                  const value = parseInt(e.target.value || '0', 10)
                  if (!value || value <= 0) {
                    setCustomCoins('')
                  } else {
                    setCustomCoins(value)
                  }
                }}
                className="w-full bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-400 outline-none"
                placeholder="Enter coins (e.g. 12000)"
              />
            </div>
            <div className="flex justify-between items-center mb-4 text-sm">
              <span className="text-gray-400">Estimated price</span>
              <span className="text-xl font-semibold text-yellow-400">
                {customCoins === '' ? '$0.00' : `$${((customCoins as number) / 100).toFixed(2)}`}
              </span>
            </div>
            <button
              disabled={customCoins === '' || (customCoins as number) <= 0}
              onClick={() => {
                if (customCoins === '' || (customCoins as number) <= 0) return
                const coins = customCoins as number
                const priceUsd = Number((coins / 100).toFixed(2))
                setSelectedPackage({
                  id: `custom_${coins}`,
                  name: `Custom ${coins.toLocaleString()} Coins`,
                  coins,
                  price_usd: priceUsd,
                  paypal_sku: `custom_${coins}`,
                  is_active: true,
                })
              }}
              className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-500"
            >
              Use this amount
            </button>
          </div>
        </div>

        {/* Checkout Panel */}
        {selectedPackage && (
          <div className="bg-[#1A1A24] border border-purple-500/30 rounded-xl p-8 max-w-2xl mx-auto">
            <h2 className="text-xl font-bold mb-4">Complete Purchase</h2>
            <p className="text-gray-400 mb-6">
              {selectedPackage.name} • {selectedPackage.coins.toLocaleString()} coins • ${selectedPackage.price_usd.toFixed(2)}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PayPal */}
              <div className="border border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <img src="/paypal.svg" alt="PayPal" className="w-6 h-6" />
                  <span className="font-semibold">PayPal</span>
                </div>
                <PayPalButtonsWrapper
                  selectedPackage={selectedPackage}
                  onApprove={handlePayPalApprove}
                />
              </div>

              {/* Manual via Cash App */}
              <ManualCashAppOption selectedPackage={selectedPackage} />
            </div>

            <button
              onClick={() => setSelectedPackage(null)}
              className="w-full mt-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-12 max-w-2xl mx-auto bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <p className="text-sm text-blue-200">
            ✓ Payments secured by PayPal • ✓ Coins credited server-side • ✓ Fraud protection enabled • ✓ Transaction logging
          </p>
        </div>
      </div>
    </div>
  )
}

type ManualProps = { selectedPackage: CoinPackage }

const ManualCashAppOption: React.FC<ManualProps> = ({ selectedPackage }) => {
  const { user, profile } = useAuthStore()
  const [creating, setCreating] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [cashTag, setCashTag] = useState('')
  const [cashTagError, setCashTagError] = useState<string | null>(null)
  const usernamePrefix = String(profile?.username || user?.email?.split('@')[0] || 'user').slice(0, 6).toUpperCase()
  const suggestedNote = `${usernamePrefix}-${selectedPackage.coins}`

  const normalizeCashTag = (value: string) => {
    const trimmed = (value || '').trim()
    const withoutDollar = trimmed.replace(/^\$+/, '')
    if (!withoutDollar) return { tag: '', error: 'Enter your Cash App tag (no $)' }
    if (!/^[A-Za-z0-9._-]{2,20}$/.test(withoutDollar)) {
      return { tag: '', error: 'Cash App tag must be 2-20 letters/numbers (no $).' }
    }
    return { tag: withoutDollar, error: '' }
  }

  const ensureCashTag = () => {
    const { tag, error } = normalizeCashTag(cashTag)
    if (error) {
      setCashTagError(error)
      toast.error(error)
      return null
    }
    setCashTagError(null)
    setCashTag(tag)
    return tag
  }

  const submitManualOrder = async () => {
    if (!user) return toast.error('Please sign in')
    const tag = ensureCashTag()
    if (!tag) return
    try {
      setCreating(true)
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-coin-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'create',
          package_id: selectedPackage.id,
          coins: selectedPackage.coins,
          amount_usd: selectedPackage.price_usd,
          username: profile?.username,
          cashapp_tag: tag,
        }),
      })
      const text = await res.text()
      let json: any = null
      try { json = JSON.parse(text) } catch {}
      if (!res.ok) throw new Error(json?.error || 'Failed to create manual order')
      setOrderId(json.orderId)
      toast.success('Manual order created. Follow the Cash App instructions below.')
    } catch (e: any) {
      console.error('Manual order error:', e)
      toast.error(e?.message || 'Failed to create manual order')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="border border-yellow-700 rounded-lg p-4 bg-yellow-900/10">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-6 h-6 text-yellow-400" />
        <span className="font-semibold">Manual (Cash App)</span>
      </div>
      <p className="text-sm text-yellow-200 mb-2">Use this while Stripe verification is pending.</p>
      <div className="mb-3">
        <div className="text-xs text-yellow-100 font-semibold mb-1">Your Cash App tag (no $)</div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-2 bg-yellow-800/40 border border-yellow-500/40 rounded text-yellow-100 text-sm">$</span>
          <input
            value={cashTag}
            onChange={(e) => setCashTag(e.target.value)}
            onBlur={() => cashTag && ensureCashTag()}
            placeholder="yourcashtag"
            className="flex-1 bg-black/30 border border-yellow-500/40 rounded px-3 py-2 text-sm text-white focus:border-yellow-300 outline-none"
          />
        </div>
        {cashTagError && <div className="text-xs text-red-300 mt-1">{cashTagError}</div>}
        <p className="text-[11px] text-yellow-200 mt-1">We attach your tag so admins can verify your Cash App payment.</p>
      </div>
      <ul className="text-sm text-yellow-100 list-disc pl-5 space-y-1 mb-3">
        <li>Send payment to <span className="font-semibold">$trollcity95</span></li>
        <li>In the Cash App note, include: <span className="font-mono">{suggestedNote}</span></li>
        <li>Example: <span className="font-mono">{usernamePrefix}-{selectedPackage.coins}</span></li>
        <li>Coins will be granted after verification.</li>
      </ul>
      <button
        disabled={creating}
        onClick={submitManualOrder}
        className="w-full py-2 bg-yellow-700 hover:bg-yellow-600 rounded-lg text-white transition disabled:opacity-50"
      >
        {creating ? 'Submitting...' : 'Submit Manual Order'}
      </button>
      {orderId && (
        <p className="mt-3 text-xs text-yellow-200">Reference ID: {orderId}. Keep this for support.</p>
      )}
    </div>
  )
}
