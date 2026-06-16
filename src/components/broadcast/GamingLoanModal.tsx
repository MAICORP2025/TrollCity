import React, { useState } from 'react';
import { X, AlertTriangle, CreditCard, Coins, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface GamingLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onLoanApproved: () => void;
}

const REQUIRED_COINS = 5000;

export default function GamingLoanModal({
  isOpen,
  onClose,
  currentBalance,
  onLoanApproved,
}: GamingLoanModalProps) {
  const [loanAmount, setLoanAmount] = useState(String(REQUIRED_COINS - currentBalance));
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const shortfall = Math.max(0, REQUIRED_COINS - currentBalance);
  const parsedAmount = parseFloat(loanAmount) || 0;
  const isValid = parsedAmount > 0 && parsedAmount <= 5000;

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error('Enter a valid loan amount between 1 and 5,000 TC');
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user?.id) {
        toast.error('You must be signed in to apply for a loan');
        return;
      }

      const { error } = await supabase.rpc('apply_for_gaming_agency_loan', {
        p_amount: parsedAmount,
      });

      if (error) throw error;

      toast.success(`Gaming loan of ${parsedAmount.toLocaleString()} TC applied! Your coins will be credited as a loan. No cashouts until loan is paid off.`);
      onLoanApproved();
      onClose();
    } catch (err: any) {
      console.error('[GamingLoanModal] Loan error:', err);
      toast.error(err?.message || 'Failed to apply for loan. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-3xl border border-amber-400/20 bg-[#0a0e1a] p-6 shadow-2xl shadow-amber-500/10">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20">
            <CreditCard className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Apply for Gaming Loan</h2>
            <p className="text-xs text-slate-400">HytroGaming Agency startup requires 5,000 TC</p>
          </div>
        </div>

        {/* Balance Info */}
        <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-slate-300">Your Balance</span>
            </div>
            <span className="text-sm font-black text-white">{currentBalance.toLocaleString()} TC</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-300">Required</span>
            <span className="text-sm font-black text-amber-300">{REQUIRED_COINS.toLocaleString()} TC</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
            <span className="text-sm font-bold text-red-400">Shortfall</span>
            <span className="text-sm font-black text-red-400">{shortfall.toLocaleString()} TC</span>
          </div>
        </div>

        {/* Loan Amount */}
        <div className="mb-4">
          <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">
            Loan Amount (Troll Coins)
          </label>
          <input
            type="number"
            value={loanAmount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') { setLoanAmount(''); return; }
              const num = parseFloat(val);
              if (num > 5000) {
                setLoanAmount('5000');
                toast.warning('Maximum gaming loan is 5,000 TC');
              } else {
                setLoanAmount(val);
              }
            }}
            placeholder={`Min ${shortfall.toLocaleString()}`}
            min={shortfall}
            max={5000}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
          />
          <p className="mt-1.5 text-[11px] text-slate-500">
            Min: {shortfall.toLocaleString()} TC · Max: 5,000 TC
          </p>
        </div>

        {/* Credit Card Charge */}
        {parsedAmount > 0 && (
          <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-black uppercase tracking-wider text-cyan-300">Credit Card Charge</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Loan Amount</span>
              <span className="text-sm font-black text-white">{parsedAmount.toLocaleString()} TC</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xs text-slate-500"> equivalent USD value</span>
              <span className="text-xs font-bold text-cyan-300">${(parsedAmount * 0.01).toFixed(2)} USD</span>
            </div>
          </div>
        )}

        {/* Terms */}
        <div className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Loan Terms & Conditions</span>
          </div>
          <ul className="space-y-1 text-[11px] text-amber-200/80 leading-relaxed">
            <li className="flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
              <span>Your credit card will be charged for the loan amount</span>
            </li>
            <li className="flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
              <span>All tips earned go toward loan balance first</span>
            </li>
            <li className="flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
              <span><strong>No cashouts allowed</strong> until loan is fully paid off</span>
            </li>
            <li className="flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
              <span>Monthly agency fee: 5,000 TC while loan is active</span>
            </li>
            <li className="flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-400" />
              <span>Loan is restricted to Hytro Gaming Agency use only</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {submitting ? 'Processing...' : 'Apply for Loan'}
          </button>
        </div>
      </div>
    </div>
  );
}
