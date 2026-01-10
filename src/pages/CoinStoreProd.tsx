// src/pages/CoinStoreProd.tsx
// Production-ready PayPal coin purchase component with centralized fulfillment
import React, { useState, useEffect } from 'react'
import { useAuthStore } from '../lib/store'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { Loader2, AlertCircle, CheckCircle, Coins } from 'lucide-react'

// Test function for debugging - call from browser console:
// window.testPayPalFulfillment('YOUR_ORDER_ID')
declare global {
  interface Window {
    testPayPalFulfillment: (orderId: string) => Promise<void>
  }
}

import type { PayPalNamespace } from '@paypal/paypal-js'

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
    const paypal = window.paypal as PayPalNamespace | null | undefined
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
        </div>

        {/* PayPal Checkout */}
        {selectedPackage && (
          <div className="bg-[#1A1A24] border border-purple-500/30 rounded-xl p-8 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4">Complete Purchase</h2>
            <p className="text-gray-400 mb-6">
              {selectedPackage.name} • {selectedPackage.coins.toLocaleString()} coins • ${selectedPackage.price_usd.toFixed(2)}
            </p>

            <PayPalButtonsWrapper
              selectedPackage={selectedPackage}
              onApprove={handlePayPalApprove}
            />

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
