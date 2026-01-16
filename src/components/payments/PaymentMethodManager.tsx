import React, { useCallback, useEffect, useRef, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../lib/store'
import { toast } from 'sonner'

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

type PaymentMethodManagerProps = {
  title?: string
  description?: string
}

export default function PaymentMethodManager({
  title = 'Wallet & Payments',
  description = 'Add a payment method to speed up Stripe Checkout in the coin store.',
}: PaymentMethodManagerProps) {
  const stripeApiBase = import.meta.env.VITE_API_URL || '/api/stripe'
  const stripePaymentBase = import.meta.env.VITE_STRIPE_PM_URL || stripeApiBase
  const { profile } = useAuthStore()
  const [methods, setMethods] = useState<Method[]>([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupCounter, setSetupCounter] = useState(0)

  const stripeRef = useRef<any>(null)
  const elementsRef = useRef<any>(null)
  const paymentElementRef = useRef<any>(null)

  const attachedRef = useRef(false)

  const load = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data, error } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', profile.id)
      .order('is_default', { ascending: false })

    if (error) toast.error(error.message)
    setMethods(data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => {
    load()

    if (profile?.id) {
      const channel = supabase
        .channel(`payment_methods_settings_${profile.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_payment_methods',
          filter: `user_id=eq.${profile.id}`
        }, () => {
          load()
        })
        .subscribe()

      return () => {
        void supabase.removeChannel(channel)
      }
    }
  }, [profile?.id, load])

  useEffect(() => {
    const initStripe = async () => {
      if (!profile?.id) return
      if (attachedRef.current) return

      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      if (!publishableKey) {
        toast.error('Stripe publishable key not configured')
        return
      }

      setSetupLoading(true)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error('No auth token')

        const res = await fetch(stripePaymentBase, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'create-setup-intent' }),
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || 'Failed to start setup')
        }

        const { clientSecret } = await res.json()
        if (!clientSecret) throw new Error('Missing setup client secret')

        const stripe = await loadStripe(publishableKey)
        if (!stripe) throw new Error('Stripe failed to load')

        const elements = stripe.elements({
          clientSecret,
          appearance: { theme: 'night' },
        })

        const container = document.getElementById('stripe-payment-element')
        if (!container) throw new Error('Payment element container missing')

        container.innerHTML = ''
        const paymentElement = elements.create('payment')
        paymentElement.mount('#stripe-payment-element')

        stripeRef.current = stripe
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

    initStripe()

    return () => {
      if (paymentElementRef.current) {
        try {
          paymentElementRef.current.destroy()
        } catch {}
        paymentElementRef.current = null
      }
      attachedRef.current = false
    }
  }, [profile?.id, setupCounter])

  const handleLinkCard = async () => {
    if (linking) return
    if (!profile?.id || !stripeRef.current || !elementsRef.current) {
      return toast.error('Please sign in.')
    }

    try {
      setLinking(true)

      const { error, setupIntent } = await stripeRef.current.confirmSetup({
        elements: elementsRef.current,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      })

      if (error) {
        throw new Error(error.message || 'Setup failed')
      }

      if (setupIntent?.status === 'succeeded') {
        // proceed
      }

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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'save-payment-method', paymentMethodId })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to save payment method')
      }

      toast.success('Payment method linked and set as default!')
      await new Promise(resolve => setTimeout(resolve, 400))
      await load()
      attachedRef.current = false
      setSetupCounter(count => count + 1)
    } catch (err: any) {
      toast.error(err?.message || 'Card link failed')
    } finally {
      setLinking(false)
    }
  }

  const remove = async (id: string) => {
    if (!profile) return
    const backup = methods
    setMethods(old => old.filter(m => m.id !== id))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('No auth token')

      const res = await fetch(stripePaymentBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete-payment-method', id })
      })

      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.success) {
        setMethods(backup)
        return toast.error(j?.error || 'Remove failed')
      }
      toast.success('Payment method removed')
      await load()
    } catch {
      setMethods(backup)
      toast.error('Remove failed')
    }
  }

  const setDefault = async (id: string) => {
    if (!profile) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('No auth token')

      const res = await fetch(stripePaymentBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'set-default-payment-method', id })
      })

      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.success) {
        return toast.error(j?.error || 'Failed to set default')
      }

      setMethods(old => old.map(x => ({ ...x, is_default: x.id === id })))
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
        <p className="text-xs text-gray-500 mt-1">
          Stripe verifies payment methods automatically (you may see a $0.00 authorization on your statement).
        </p>
      </div>

      <div className="p-6 bg-[#121212] rounded-lg border border-[#2C2C2C]">
        <h3 className="text-lg font-semibold mb-3">Link New Payment Method</h3>
        <div id="stripe-payment-element" className="p-3 rounded border border-[#2C2C2C] bg-black" />

        <button
          onClick={handleLinkCard}
          disabled={linking || setupLoading}
          className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-700 rounded transition disabled:opacity-50"
        >
          {linking ? 'Saving…' : setupLoading ? 'Loading…' : 'Save Payment Method'}
        </button>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <div key={m.id} className="p-4 rounded border border-[#2C2C2C] flex items-center justify-between">
              <div>
                <div className="font-semibold">{m.display_name || 'Payment Method'}</div>
                {m.brand && (
                  <div className="text-xs text-gray-400">
                    {m.brand} •••• {m.last4} • exp {String(m.exp_month).padStart(2,'0')}/{m.exp_year}
                  </div>
                )}
                {m.is_default && <div className="text-xs text-green-400">Default</div>}
              </div>
              <div className="flex gap-2">
                {!m.is_default && (
                  <button
                    onClick={() => setDefault(m.id)}
                    className="px-3 py-2 rounded bg-green-500 text-black"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => remove(m.id)}
                  className="px-3 py-2 rounded bg-gray-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {methods.length === 0 && <div>No methods linked.</div>}
        </div>
      )}
    </div>
  )
}
