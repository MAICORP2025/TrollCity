import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { CreditCard, Loader2, CheckCircle, Lock } from 'lucide-react'

// PayPal SDK types
declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: any;
  userId: string;
  profile: any;
  onPaymentSuccess?: (data: any) => void;
  onSaveCard?: boolean;
  requireCardOnFile?: boolean;
  onCardSaved?: () => void;
  saveOnly?: boolean;
  onProfileUpdate?: (profile: any) => void;
}

export default function PayPalPaymentModal({
  isOpen,
  onClose,
  pkg,
  userId,
  profile,
  onPaymentSuccess,
  onSaveCard = false,
  requireCardOnFile = false,
  onCardSaved,
  saveOnly = false,
  onProfileUpdate,
}: PayPalPaymentModalProps) {
  const [step, setStep] = useState<'select' | 'processing' | 'success'>('select');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const paypalButtonsRef = useRef<HTMLDivElement>(null);
  const paypalOrderIdRef = useRef<string | null>(null);

  const coins = pkg?.coins ?? pkg?.coin_amount ?? pkg?.coinAmount;
  const rawPrice = pkg?.price_usd ?? pkg?.amount_usd ?? pkg?.price;
  const amountUsd = typeof rawPrice === 'number' ? rawPrice : Number(String(rawPrice ?? '').replace(/[^0-9.]/g, '').trim());
  const packageName = pkg?.name || `${coins} Troll Coins`;
  const packageId = pkg?.id || 'coins';
  const purchaseType = pkg?.purchaseType || 'coins';

  // Load PayPal SDK and render buttons
  useEffect(() => {
    if (isOpen && paypalButtonsRef.current && !paypalButtonsRef.current.hasChildNodes()) {
      loadPayPalSDK();
    }
  }, [isOpen]);

  // Reset modal when opened
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setPaymentResult(null);
      paypalOrderIdRef.current = null;

      // Clear any existing PayPal buttons
      if (paypalButtonsRef.current) {
        paypalButtonsRef.current.innerHTML = '';
      }
    }
  }, [isOpen]);

  const loadPayPalSDK = async () => {
    if (window.paypal) {
      renderPayPalButtons();
      return;
    }

    const script = document.createElement('script');
    if (!import.meta.env.VITE_PAYPAL_CLIENT_ID) {
      toast.error('PayPal client ID not configured');
      setStep('select');
      return;
    }
    script.src = `https://www.paypal.com/sdk/js?client-id=${import.meta.env.VITE_PAYPAL_CLIENT_ID}&currency=USD&intent=capture`;
    script.onload = () => renderPayPalButtons();
    script.onerror = () => {
      toast.error('Failed to load PayPal. Please try again.');
      setStep('select');
    };
    document.head.appendChild(script);
  };

  const renderPayPalButtons = () => {
    if (!window.paypal || !paypalButtonsRef.current) return;

    window.paypal.Buttons({
      createOrder: async () => {
        try {
          const { data, error } = await supabase.functions.invoke('create-paypal-order', {
            body: {
              userId,
              coins,
              amountUsd,
              packageId,
              packageName,
              purchaseType,
            },
          });

          if (error) throw new Error(error.message || 'Failed to create PayPal order');
          if (!data?.success) throw new Error(data?.error || 'Failed to create payment order');

          paypalOrderIdRef.current = data.paypalOrderId;
          return data.paypalOrderId;
        } catch (err: any) {
          console.error('PayPal order creation error:', err);
          toast.error(err?.message || 'Failed to create PayPal order');
          throw err;
        }
      },

      onApprove: async (data: any) => {
        setStep('processing');

        try {
          const { data: verifyData, error } = await supabase.functions.invoke('verify-paypal-payment', {
            body: {
              paypalOrderId: data.orderID,
              orderId: paypalOrderIdRef.current,
              expectedAmount: amountUsd,
              userId,
            },
          });

          if (error) throw new Error(error.message || 'Payment verification failed');
          if (!verifyData?.verified) throw new Error(verifyData?.error || 'Payment not verified');

          setPaymentResult(verifyData);
          setStep('success');
          onPaymentSuccess?.(verifyData);
          toast.success('Payment successful! Coins have been added to your account.');
        } catch (err: any) {
          console.error('PayPal payment verification error:', err);
          toast.error(err?.message || 'Payment verification failed');
          setStep('select');
        }
      },

      onError: (err: any) => {
        console.error('PayPal error:', err);
        toast.error('PayPal payment failed. Please try again.');
        setStep('select');
      },

      onCancel: () => {
        console.log('PayPal payment cancelled');
        toast.info('Payment cancelled');
        setStep('select');
      },

       style: {
         layout: 'vertical',
         color: 'black',
         shape: 'rect',
         label: 'paypal',
         height: 48,
       },
    }).render(paypalButtonsRef.current);
  };

   // Reset PayPal button container margins when modal opens
   useEffect(() => {
     if (isOpen) {
       const style = document.createElement('style');
       style.id = 'paypal-button-fix';
       style.textContent = `
         .paypal-buttons-container > * {
           margin-bottom: 0 !important;
           padding-bottom: 0 !important;
         }
         .paypal-buttons-container .paypal-button-container {
           margin: 0 auto !important;
         }
       `;
       document.head.appendChild(style);
       
       return () => {
         document.head.removeChild(style);
       };
     }
   }, [isOpen]);

   const handleClose = () => {
     setStep('select');
     setPaymentResult(null);
     onClose();
   };

  if (!pkg) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
        {/* Fix PayPal button extra spacing */}
        <style>
          {`
            .paypal-buttons-container > * {
              margin-bottom: 0 !important;
              padding-bottom: 0 !important;
            }
            .paypal-buttons-container .paypal-button-container {
              margin: 0 auto !important;
            }
          `}
        </style>
        
        <DialogHeader>
           <DialogTitle className="flex items-center gap-2 text-xl">
             <CreditCard className="w-5 h-5 text-blue-400" />
             {saveOnly ? 'Save PayPal' : 'Pay with PayPal'}
           </DialogTitle>
           <DialogDescription className="text-zinc-400">
             {step === 'select'
               ? `Complete your purchase of ${coins?.toLocaleString()} coins for $${amountUsd?.toFixed(2)}`
               : step === 'processing'
               ? 'Creating PayPal order...'
               : 'PayPal order created successfully!'}
           </DialogDescription>
         </DialogHeader>

          {/* Custom style to fix PayPal button white space */}
          

          {step === 'select' && (
          <div className="space-y-4 py-4">
            {/* Package Summary */}
            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-400">Package</span>
                <span className="font-bold text-yellow-400">{coins?.toLocaleString()} Coins</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Total</span>
                <span className="font-bold text-white text-xl">${amountUsd?.toFixed(2)}</span>
              </div>
            </div>

            {/* PayPal Buttons Container */}
            <div className="space-y-4">
              <div className="text-center text-zinc-400 text-sm mb-2">
                Click the PayPal button below to complete your purchase securely
              </div>
              <div ref={paypalButtonsRef} className="paypal-buttons-container flex justify-center min-h-[48px]"></div>
            </div>

            {/* Security Notice */}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Lock className="w-3 h-3" />
              <span>Secure payment processed by PayPal</span>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
            <p className="text-zinc-400">Creating PayPal order...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-6 flex flex-col items-center justify-center">
            <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
            <p className="text-lg font-semibold text-white mb-2">Payment Successful!</p>
            <p className="text-zinc-400 text-sm text-center mb-4">
              {coins?.toLocaleString()} coins have been added to your account.
              Thank you for your purchase!
            </p>
            {paymentResult?.captureId && (
              <p className="text-xs text-zinc-500">Transaction: {paymentResult.captureId}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <div className="flex justify-end gap-2 w-full">
            {step === 'select' ? (
              <Button
                onClick={handleClose}
                variant="outline"
                className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
            ) : (
              <Button
                onClick={handleClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Done
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}