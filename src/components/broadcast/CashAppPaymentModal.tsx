import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';

interface CashAppPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageId?: string;
  coins: number;
  amount: number;
  onSuccess?: (orderId: string) => void;
}

export default function CashAppPaymentModal({
  isOpen,
  onClose,
  coins,
  amount,
  onSuccess,
}: CashAppPaymentModalProps) {
  const { user, profile } = useAuthStore();
  const [step, setStep] = useState<'confirm' | 'awaiting' | 'success'>('confirm');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [noteSuggested, setNoteSuggested] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [cashTag, setCashTag] = useState('');
  const [cashTagError, setCashTagError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('confirm');
      setOrderId(null);
      setLoading(false);
      setCopied(false);
      setCashTag('');
      setCashTagError(null);
    }
  }, [isOpen]);

  const normalizeCashTag = (value: string) => {
    const trimmed = (value || '').trim();
    const withoutDollar = trimmed.replace(/^\$+/, '');
    if (!withoutDollar) return { tag: '', error: 'Enter your Cash App tag (no $)' };
    if (!/^[A-Za-z0-9._-]{2,20}$/.test(withoutDollar)) {
      return { tag: '', error: 'Cash App tag must be 2-20 letters/numbers (no $).' };
    }
    return { tag: withoutDollar, error: '' };
  };

  const ensureCashTag = () => {
    const { tag, error } = normalizeCashTag(cashTag);
    if (error) {
      setCashTagError(error);
      toast.error(error);
      return null;
    }
    setCashTagError(null);
    setCashTag(tag);
    return tag;
  };

  const handleCreateOrder = async () => {
    if (!user) {
      toast.error('You must be logged in');
      return;
    }

    const tag = ensureCashTag();
    if (!tag) return;

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual-coin-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'create',
          coins,
          amount_usd: amount,
          username: profile?.username || user.email?.split('@')[0] || 'user',
          cashapp_tag: tag,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create order (${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.orderId) {
        throw new Error('No order ID returned');
      }

      setOrderId(data.orderId);
      setNoteSuggested(data.instructions?.note || '');
      setStep('awaiting');
      toast.success('Payment request created! Follow the Cash App instructions below.');
      onSuccess?.(data.orderId);
    } catch (err: any) {
      console.error('Failed to create manual order:', err);
      toast.error(err?.message || 'Failed to create payment request');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyNote = () => {
    if (noteSuggested) {
      navigator.clipboard.writeText(noteSuggested);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-purple-500/30">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Cash App Payment</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Coins</span>
                <span className="text-xl font-bold text-white">{coins.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Amount</span>
                <span className="text-xl font-bold text-green-400">${amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-300 font-semibold">Your Cash App tag (no $)</label>
              <div className="flex items-center gap-2">
                <span className="px-2 py-2 bg-gray-800 rounded border border-gray-700 text-gray-200 text-sm">$</span>
                <input
                  value={cashTag}
                  onChange={(e) => setCashTag(e.target.value)}
                  onBlur={() => cashTag && ensureCashTag()}
                  placeholder="yourcashtag"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-green-400 outline-none"
                />
              </div>
              {cashTagError && <p className="text-xs text-red-300">{cashTagError}</p>}
              <p className="text-[11px] text-gray-400">We include this tag for admins/secretaries to match your Cash App payment.</p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex gap-3">
              <AlertCircle size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-100">
                <p className="font-semibold mb-1">How it works:</p>
                <ol className="space-y-1 text-xs list-decimal list-inside">
                  <li>Send ${amount.toFixed(2)} via Cash App to <span className="font-bold">$trollcity95</span></li>
                  <li>Include the reference code in your payment note</li>
                  <li>Our team verifies the payment</li>
                  <li>Coins are granted to your account</li>
                </ol>
              </div>
            </div>

            <button
              onClick={handleCreateOrder}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating Request...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Proceed to Cash App
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {step === 'awaiting' && (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-white">Your Payment Instructions</h3>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Send to</p>
                  <div className="bg-gray-800 rounded px-3 py-2 font-mono text-white flex items-center justify-between">
                    <span className="font-bold">$trollcity95</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('$trollcity95');
                        toast.success('Copied!');
                      }}
                      className="hover:bg-gray-700 p-1 rounded transition-colors"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1">Amount</p>
                  <div className="bg-gray-800 rounded px-3 py-2 font-mono text-green-400 font-bold">
                    ${amount.toFixed(2)}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-400 mb-1">Payment Note (Include with payment)</p>
                  <div className="bg-gray-800 rounded px-3 py-2 font-mono text-white flex items-center justify-between gap-2">
                    <span className="font-bold">{noteSuggested}</span>
                    <button
                      onClick={handleCopyNote}
                      className="hover:bg-gray-700 p-1 rounded transition-colors flex-shrink-0"
                    >
                      <Copy size={16} className={copied ? 'text-green-400' : ''} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This reference code helps us identify your payment
                  </p>
                </div>
              </div>

              <div className="bg-gray-800 rounded p-3 text-sm text-gray-300">
                <p className="font-semibold mb-1">What happens next?</p>
                <ul className="space-y-1 text-xs">
                  <li>✓ We receive your Cash App notification</li>
                  <li>✓ Admin verifies the payment (usually within 24 hours)</li>
                  <li>✓ {coins.toLocaleString()} coins are added to your account</li>
                  <li>✓ You'll get a notification when complete</li>
                </ul>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Done - I'll Complete Payment
            </button>

            <p className="text-xs text-gray-500 text-center">
              Order ID: <span className="font-mono">{orderId}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
