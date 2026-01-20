import React from 'react'
import { CreditCard } from 'lucide-react'

// Stripe toggle: verification flow stays intact; buttons are disabled when Stripe is turned off.
// const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED !== 'false'
// const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
// const stripePaymentBase = '/stripe-payment-methods'

// const CASH_APP_PROVIDER = 'square'

export type PaymentMethodManagerProps = {
  title?: string
  description?: string
}

/*
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
*/

export default function PaymentMethodManager({
  title = 'Payment Methods',
  description = 'Manage your saved payment methods for faster checkout.'
}: PaymentMethodManagerProps) {
  // const { profile } = useAuthStore()

  // const [methods, setMethods] = useState<Method[]>([])
  // const [loading, setLoading] = useState(true)
  // const [linking, setLinking] = useState(false)
  // const [setupLoading, setSetupLoading] = useState(false)
  // const [squareLoading, setSquareLoading] = useState(false)
  // const [activeProvider, setActiveProvider] = useState<'stripe' | 'square'>('stripe')
  // const [setupCounter, setSetupCounter] = useState(0)

  // const stripeRef = useRef<Stripe | null>(null)
  // const elementsRef = useRef<StripeElements | null>(null)
  // const paymentElementRef = useRef<StripePaymentElement | null>(null)
  // const attachedRef = useRef(false)

  // const squarePaymentsRef = useRef<SquarePayments | null>(null)
  // const squareAttachedRef = useRef(false)
  // const cashAppPayRef = useRef<any>(null)

  /*
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
  */

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-gray-400">{description}</p>
      </div>

      <div className="p-6 bg-[#121212] rounded-lg border border-[#2C2C2C] text-center">
        <div className="flex flex-col items-center justify-center py-8">
          <CreditCard className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-300 mb-2">Payment Methods Disabled</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            External payment methods (Stripe, Square) are currently disabled as we transition to the internal Troll Bank economy.
          </p>
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg max-w-md w-full">
            <h4 className="text-blue-400 font-bold mb-1">Did you know?</h4>
            <p className="text-xs text-blue-300">
              You can apply for loans directly from the Troll Bank to get coins!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
