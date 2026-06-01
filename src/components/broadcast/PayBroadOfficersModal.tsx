import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { X, Shield, Gift, AlertTriangle, Loader2 } from 'lucide-react';

interface PayBroadOfficersModalProps {
  isOpen: boolean;
  onClose: () => void;
  broadcasterId: string;
  broadcasterBalance: number;
  streamId: string;
}

interface BroadOfficer {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

export default function PayBroadOfficersModal({
  isOpen,
  onClose,
  broadcasterId,
  broadcasterBalance,
  streamId,
}: PayBroadOfficersModalProps) {
  const [officers, setOfficers] = useState<BroadOfficer[]>([]);
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const amountNum = parseInt(amount, 10) || 0;
  const officerCount = officers.length;
  const totalCost = amountNum * officerCount;
  const canAfford = totalCost <= broadcasterBalance;
  const isValid = amountNum > 0 && officerCount > 0 && canAfford;

  useEffect(() => {
    if (!isOpen || !streamId) return;
    setAmount('');
    setLoading(false);

    const fetchOfficers = async () => {
      setFetching(true);
      try {
        const { data, error } = await supabase.rpc('get_broadofficers', {
          p_stream_id: broadcasterId,
        });
        if (error) throw error;
        setOfficers(data || []);
      } catch (err) {
        console.error('Failed to fetch broadofficers:', err);
        setOfficers([]);
      } finally {
        setFetching(false);
      }
    };

    fetchOfficers();
  }, [isOpen, streamId, broadcasterId]);

  const handlePay = useCallback(async () => {
    if (!isValid || loading) return;

    setLoading(true);
    try {
      // TODO: Replace with pay_stream_broadofficers_v1 RPC when deployed.
      // For now, use individual coin transactions via existing RPCs.
      // This is NOT atomic — if one fails, previous payments still go through.
      // The RPC should be used for production to ensure atomicity.

      const { data, error } = await supabase.rpc('pay_stream_broadofficers_v1', {
        p_stream_id: streamId,
        p_amount_per_officer: amountNum,
      });

      if (error) throw error;

      toast.success(
        `Paid ${officerCount} officer${officerCount !== 1 ? 's' : ''} ${amountNum} coins each (${totalCost} total)`
      );
      onClose();
    } catch (err: any) {
      console.error('Pay broadofficers error:', err);
      toast.error(err.message || 'Failed to pay officers');
    } finally {
      setLoading(false);
    }
  }, [isValid, loading, streamId, amountNum, officerCount, totalCost, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-cyan-400/20 bg-slate-950/95 shadow-[0_0_40px_rgba(34,211,238,0.15)] backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/30 bg-purple-500/10">
              <Shield className="h-5 w-5 text-purple-300" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Pay BroadOfficers</h3>
              <p className="text-[11px] text-slate-400">Pay all current officers in this stream</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Officer count */}
          <div className="flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700/40 px-4 py-3">
            <span className="text-sm text-slate-300">Current BroadOfficers</span>
            <span className="text-lg font-black text-cyan-300">
              {fetching ? <Loader2 className="h-5 w-5 animate-spin" /> : officerCount}
            </span>
          </div>

          {/* Officer list */}
          {officers.length > 0 && (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {officers.map((officer) => (
                <div key={officer.user_id} className="flex items-center gap-2 rounded-lg bg-slate-800/40 px-3 py-2">
                  {officer.avatar_url ? (
                    <img src={officer.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20">
                      <Shield className="h-3 w-3 text-purple-300" />
                    </div>
                  )}
                  <span className="text-xs font-bold text-white truncate">{officer.username || 'Unknown'}</span>
                </div>
              ))}
            </div>
          )}

          {officers.length === 0 && !fetching && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-center">
              <p className="text-xs text-amber-300">No BroadOfficers assigned to this stream</p>
            </div>
          )}

          {/* Amount input */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Coins per Officer
            </label>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount..."
              className="w-full rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-white outline-none transition focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Total cost */}
          {amountNum > 0 && officerCount > 0 && (
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 px-4 py-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Per officer</span>
                <span className="font-bold text-white">{amountNum.toLocaleString()} coins</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Officers</span>
                <span className="font-bold text-white">× {officerCount}</span>
              </div>
              <div className="border-t border-slate-700/50 pt-1 mt-1 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300">Total</span>
                <span className={`text-sm font-black ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalCost.toLocaleString()} coins
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Your balance</span>
                <span className="font-bold text-slate-300">{broadcasterBalance.toLocaleString()} coins</span>
              </div>
            </div>
          )}

          {/* Warnings */}
          {amountNum > 0 && !canAfford && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span className="text-xs text-red-300">Insufficient balance</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-white/10 px-5 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-700/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={!isValid || loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(168,85,247,0.25)] transition hover:from-purple-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Gift className="h-4 w-4" />
                Pay {totalCost.toLocaleString()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
