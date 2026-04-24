import React, { useState, useEffect } from 'react';
import { useCoins } from '@/lib/hooks/useCoins';
import { toast } from 'sonner';
import { X, AlertTriangle, Coins } from 'lucide-react';
import { STORE_USD_PER_COIN } from '@/lib/coinMath';

interface CashoutDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CashoutDepositModal({ isOpen, onClose }: CashoutDepositModalProps) {
  const { depositToCashout, loading, troll_coins, paid_coins, cashout_coins } = useCoins();
  const [amount, setAmount] = useState('');

  const totalAvailableCoins = (troll_coins || 0) + (paid_coins || 0);
  const maxDeposit = totalAvailableCoins;
  const maxCashoutValue = maxDeposit * STORE_USD_PER_COIN;

  const handleAmountChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > maxDeposit) {
      toast.error(`Maximum you can deposit is ${maxDeposit.toLocaleString()} coins`);
      setAmount(maxDeposit.toString());
    } else {
      setAmount(value);
    }
  };

  const handleDeposit = async () => {
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    if (numAmount > maxDeposit) {
      toast.error(`Insufficient coins. You only have ${maxDeposit.toLocaleString()} coins available.`);
      return;
    }

    if (numAmount < 5000) {
      toast.error('Minimum 5,000 coins required for cashout payout');
      return;
    }

    const result = await depositToCashout(numAmount);
    if (result.success) {
      toast.success(`Deposited ${numAmount.toLocaleString()} coins to cashout!`);
      setAmount('');
      onClose();
    } else {
      toast.error(result.error || 'Failed to deposit');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setAmount('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-bold text-white mb-4">Deposit to Cashout</h2>
        
        <div className="space-y-4">
          <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Your Available Coins:</span>
              <span className="text-yellow-400 font-mono">{totalAvailableCoins.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Max Cashout Value:</span>
              <span className="text-green-400 font-mono">${maxCashoutValue.toFixed(2)}</span>
            </div>
            <div className="text-xs text-zinc-500 mt-2">
              Minimum 5,000 coins required for payout (processed Fridays)
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Amount to Deposit</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="Enter amount (min 5,000)"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white"
              max={maxDeposit}
            />
          </div>

          {maxDeposit < 5000 && (
            <div className="flex items-start gap-2 text-amber-400 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>You need at least 5,000 coins to cash out. Keep streaming and receiving gifts!</span>
            </div>
          )}
          
          <button
            onClick={handleDeposit}
            disabled={loading || !amount || maxDeposit < 5000}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white py-2 rounded-lg font-medium"
          >
            {loading ? 'Depositing...' : 'Deposit to Cashout'}
          </button>
        </div>
      </div>
    </div>
  );
}