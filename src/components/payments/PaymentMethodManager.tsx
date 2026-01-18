import React, { useCallback, useEffect, useRef, useState } from 'react'
import { loadStripe, Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import api from '../../lib/api'
import { toast } from 'sonner'
import { CreditCard, Smartphone, ShieldCheck } from 'lucide-react'

// Stripe toggle: verification flow stays intact; buttons are disabled when Stripe is turned off.
const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED !== 'false'
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePaymentBase = '/stripe-payment-methods'

const CASH_APP_PROVIDER = 'square'

export type PaymentMethodManagerProps = {
  title?: string
  description?: string
}

type Method = {
  id: string
  provider: string
  display_name: string
  is_default: boolean
  brand?: string
  last4?: string
  exp_month?: number
  exp_year?: number
}

type SquarePayments = {
  cashAppPay: (options: any) => Promise<any>
}

declare global {
  interface Window {
    Square?: { payments: (appId: string, locationId: string) => SquarePayments }
  }
}

export default function PaymentMethodManager({
  title = 'Payment Methods',
  description = 'Manage your saved payment methods for faster checkout.'
}: PaymentMethodManagerProps) {
  const { profile } = useAuthStore()

  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const [squareLoading, setSquareLoading] = useState(false)
  const [activeProvider, setActiveProvider] = useState<'stripe' | 'square'>('stripe')
  const [setupCounter, setSetupCounter] = useState(0)

  const stripeRef = useRef<Stripe | null>(null)
  const elementsRef = useRef<StripeElements | null>(null)
  const paymentElementRef = useRef<StripePaymentElement | null>(null)
  const attachedRef = useRef(false)

  const squarePaymentsRef = useRef<SquarePayments | null>(null)
  const squareAttachedRef = useRef(false)
  const cashAppPayRef = useRef<any>(null)

  const loadMethods = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(stripePaymentBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'list-payment-methods' })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to load payment methods')
      }

      const json = await res.json().catch(() => null)
      if (!json || !Array.isArray(json.methods)) {
        throw new Error('Invalid payment methods response')
      }

      setMethods(json.methods)
    } catch (err: any) {
      console.error('Load methods failed', err)
      toast.error(err?.message || 'Unable to load payment methods')
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    const initStripe = async () => {
      if (!STRIPE_ENABLED) return
      if (!profile?.id) return
      if (activeProvider !== 'stripe') return
      if (attachedRef.current) return
      if (!STRIPE_PUBLISHABLE_KEY) {
        toast.error('Stripe publishable key is missing')
        return
      }

      setSetupLoading(true)
      try {
        if (!stripeRef.current) {
          stripeRef.current = await loadStripe(STRIPE_PUBLISHABLE_KEY)
        }

        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error('No auth token')

        const setupRes = await fetch(stripePaymentBase, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ action: 'create-setup-intent' })
        })

        if (!setupRes.ok) {
          const text = await setupRes.text()
          throw new Error(text || 'Failed to create setup intent')
        }

        const { clientSecret } = await setupRes.json()
        if (!clientSecret) throw new Error('Missing client secret')

        const stripe = stripeRef.current
        if (!stripe) throw new Error('Stripe failed to initialize')

        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: 'night',
            variables: {
              colorText: '#E5E7EB',
              colorBackground: '#0B0B0F'
            }
          }
        })

        const paymentElement = elements.create('payment')
        paymentElement.mount('#stripe-payment-element')

        elementsRef.current = elements
        paymentElementRef.current = paymentElement
        attachedRef.current = true
      } catch (err: any) {
        console.error('Stripe setup error:', err)
        toast.error(err?.message || 'Stripe setup failed')
      } finally {
        setSetupLoading(false)
      }
    }

    const initSquare = async () => {
      if (!profile?.id) return
      if (squareAttachedRef.current) return
      if (activeProvider !== 'square') return

      const appId = import.meta.env.VITE_SQUARE_APPLICATION_ID
      const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID
      const env = import.meta.env.VITE_SQUARE_ENVIRONMENT || 'sandbox'

      if (!appId || !locationId) {
        toast.error('Square Cash App not configured')
        return
      }

      setSquareLoading(true)
      try {
        const sdkUrl = env === 'production'
          ? 'https://web.squarecdn.com/v1/square.js'
          : 'https://sandbox.web.squarecdn.com/v1/square.js'

        if (!window.Square) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = sdkUrl
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load Square SDK'))
            document.body.appendChild(script)
          })
        }

        const payments = window.Square?.payments?.(appId, locationId)
        if (!payments) throw new Error('Square failed to initialize')
        squarePaymentsRef.current = payments

        const cashAppPay = await payments.cashAppPay({
          redirectURL: window.location.href,
          referenceId: `tc_setup_${profile.id}_${Date.now()}`
        })

        const container = document.getElementById('cash-app-pay-element')
        if (!container) throw new Error('Cash App container not found')

        container.innerHTML = ''
        await cashAppPay.attach('#cash-app-pay-element')

        cashAppPay.addEventListener('ontokenization', async (event: any) => {
          const { token, errors } = event.detail
          if (errors) {
            console.error('CashApp tokenization error:', errors)
            toast.error(errors[0]?.message || 'Failed to connect Cash App')
            return
          }

          setLinking(true)
          try {
            const res = await api.post('/payments', {
              userId: profile.id,
              nonce: token
            })

            if (!res.success) throw new Error(res.error || 'Failed to save account')
            toast.success('Cash App connected successfully!')
            await loadMethods()
            setSetupCounter((c) => c + 1)
          } catch (err: any) {
            toast.error(err?.message || 'Linking failed')
          } finally {
            setLinking(false)
          }
        })

        cashAppPayRef.current = cashAppPay
        squareAttachedRef.current = true
      } catch (err: any) {
        console.error('Square setup error:', err)
        toast.error(err?.message || 'Failed to initialize Cash App')
      } finally {
        setSquareLoading(false)
      }
    }

    if (activeProvider === 'stripe') {
      initStripe()
    } else {
      initSquare()
    }

    return () => {
      if (paymentElementRef.current) {
        try {
          paymentElementRef.current.destroy()
        } catch {}
        paymentElementRef.current = null
      }
      attachedRef.current = false

      if (cashAppPayRef.current) {
        try {
          cashAppPayRef.current.destroy()
        } catch {}
        cashAppPayRef.current = null
      }
      squareAttachedRef.current = false
    }
  }, [profile?.id, setupCounter, activeProvider, loadMethods])

  useEffect(() => {
    loadMethods()
  }, [loadMethods])

  const handleLinkCard = async () => {
    if (linking) return
    if (!profile?.id || !stripeRef.current || !elementsRef.current) {
      return toast.error('Please sign in.')
    }

    try {
      setLinking(true)

      const { error, setupIntent } = await stripeRef.current.confirmSetup({
        elements: elementsRef.current,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required'
      })

      if (error) throw new Error(error.message || 'Setup failed')

      const paymentMethodId = setupIntent?.payment_method
      if (!paymentMethodId || typeof paymentMethodId !== 'string') {
        throw new Error('Missing payment method')
      }

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('No auth token')

      const res = await fetch(stripePaymentBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'save-payment-method', paymentMethodId })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to save payment method')
      }

      toast.success('Payment method linked and set as default!')
      await loadMethods()
      attachedRef.current = false
      setSetupCounter((count) => count + 1)
    } catch (err: any) {
      toast.error(err?.message || 'Card link failed')
    } finally {
      setLinking(false)
    }
  }

  const remove = async (id: string) => {
    if (!profile) return
    const method = methods.find((m) => m.id === id)
    if (!method) return

    const backup = methods
    setMethods((old) => old.filter((m) => m.id !== id))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('No auth token')

      const isSquare = method.provider === CASH_APP_PROVIDER
      const endpoint = isSquare ? '/payments' : stripePaymentBase

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'delete-payment-method', id })
      })

      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.success) {
        setMethods(backup)
        return toast.error(j?.error || 'Remove failed')
      }
      toast.success('Payment method removed')
      await loadMethods()
    } catch (err: any) {
      setMethods(backup)
      toast.error(err?.message || 'Remove failed')
    }
  }

  const setDefault = async (id: string) => {
    if (!profile) return
    const method = methods.find((m) => m.id === id)
    if (!method) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('No auth token')

      const isSquare = method.provider === CASH_APP_PROVIDER
      const endpoint = isSquare ? '/payments' : stripePaymentBase

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'set-default-payment-method', id })
      })

      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.success) {
        return toast.error(j?.error || 'Failed to set default')
      }

      setMethods((old) => old.map((x) => ({ ...x, is_default: x.id === id })))
      toast.success('Default payment method updated')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to set default')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-gray-400">{description}</p>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-green-400" />
          Securely link your payment method for faster checkout.
        </p>
      </div>

      <div className="p-6 bg-[#121212] rounded-lg border border-[#2C2C2C]">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveProvider('stripe')}
            disabled={!STRIPE_ENABLED}
            className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition ${
              activeProvider === 'stripe'
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-black/40 border-gray-800 text-gray-400 hover:border-gray-700'
            } ${!STRIPE_ENABLED ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <CreditCard className="w-5 h-5" />
            <div className="text-left leading-tight">
              <div className="font-semibold">Credit Card</div>
              <div className="text-[10px] opacity-70 italic">Powered by Stripe</div>
            </div>
          </button>
          <button
            onClick={() => setActiveProvider('square')}
            className={`flex-1 py-3 px-4 rounded-lg border flex items-center justify-center gap-2 transition ${
              activeProvider === 'square'
                ? 'bg-[#00D632]/10 border-[#00D632] text-[#00D632]'
                : 'bg-black/40 border-gray-800 text-gray-400 hover:border-gray-700'
            }`}
          >
            <Smartphone className="w-5 h-5" />
            <div className="text-left leading-tight">
              <div className="font-semibold">Cash App Pay</div>
              <div className="text-[10px] opacity-70 italic">Powered by Square</div>
            </div>
          </button>
        </div>

        {!STRIPE_ENABLED && activeProvider === 'stripe' && (
          <div className="mb-4 text-sm text-yellow-300 bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-2">
            Stripe verification is temporarily disabled. Card linking is paused.
          </div>
        )}

        {activeProvider === 'stripe' ? (
          <>
            <div id="stripe-payment-element" className="p-3 rounded border border-[#2C2C2C] bg-black" />
            <button
              onClick={handleLinkCard}
              disabled={linking || setupLoading || !STRIPE_ENABLED}
              className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded transition disabled:opacity-50"
            >
              {linking ? 'Saving…' : setupLoading ? 'Loading…' : 'Save Payment Method'}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#00D632]/5 border border-[#00D632]/20 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-300 mb-4 font-medium">
                Scan the QR code with your phone to connect Cash App
              </p>
              <div id="cash-app-pay-element" className="flex justify-center min-h-[50px]" />
              {squareLoading && <div className="text-xs text-gray-500 mt-2">Initializing Cash App Pay...</div>}
            </div>
            <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest font-bold">
              Securely connected via Square
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <div key={m.id} className="p-4 rounded border border-[#2C2C2C] flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    m.provider === CASH_APP_PROVIDER ? 'bg-[#00D632]/20 text-[#00D632]' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {m.provider === CASH_APP_PROVIDER ? <Smartphone size={20} /> : <CreditCard size={20} />}
                </div>
                <div>
                  <div className="font-semibold">
                    {m.provider === CASH_APP_PROVIDER ? 'Cash App' : m.display_name || 'Payment Method'}
                  </div>
                  {m.brand && m.provider !== CASH_APP_PROVIDER && (
                    <div className="text-xs text-gray-400">
                      {m.brand} •••• {m.last4} • exp {String(m.exp_month).padStart(2, '0')}/{m.exp_year}
                    </div>
                  )}
                  {m.is_default && <div className="text-xs text-green-400 font-medium">Default Payment Method</div>}
                </div>
              </div>
              <div className="flex gap-2">
                {!m.is_default && (
                  <button
                    onClick={() => setDefault(m.id)}
                    className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm transition"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => remove(m.id)}
                  className="px-3 py-1.5 rounded bg-gray-800 hover:bg-red-900/40 hover:text-red-400 transition text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {methods.length === 0 && (
            <div className="text-center py-8 bg-black/10 rounded-lg border border-dashed border-gray-800 text-gray-500 text-sm">
              No saved payment methods.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
