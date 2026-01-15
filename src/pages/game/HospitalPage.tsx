import React, { useState } from 'react';
import { Activity, Heart, Pill } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { deductCoins } from '../../lib/coinTransactions';
import { toast } from 'sonner';

export default function HospitalPage() {
  const { user, profile } = useAuthStore();
  const [recovering, setRecovering] = useState(false);

  const handleInstantRecovery = async () => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    const price = 1000;
    if ((profile.troll_coins || 0) < price) {
      toast.error('Not enough troll coins');
      return;
    }

    setRecovering(true);
    try {
      const result = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'purchase',
        description: 'Instant raid debuff recovery',
        metadata: { source: 'hospital', action: 'instant_recovery' }
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to recover');
        return;
      }

      toast.success('Debuffs cleared. You feel refreshed.');
      localStorage.setItem(`trollcity_debuff_${user.id}`, JSON.stringify({ active: false }));
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pt-24 pb-20">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center gap-4">
          <div className="p-4 bg-emerald-600/20 rounded-2xl border border-emerald-500/30">
            <Activity size={32} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              Troll General Hospital
            </h1>
            <p className="text-gray-400">Recover from raids and get back in the game.</p>
          </div>
        </header>

        <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 text-center">
            <Heart size={64} className="mx-auto text-red-500 animate-pulse mb-6" />
            <h2 className="text-2xl font-bold mb-2">Feeling Unwell?</h2>
            <p className="text-gray-400 max-w-md mx-auto mb-8">
              If you've been raided recently, you might be suffering from a debuff. 
              Rest here to clear your status effects.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleInstantRecovery}
                disabled={recovering}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Pill size={20} />
                {recovering ? 'Processing...' : 'Instant Recovery (1000 Coins)'}
              </button>
              <button className="px-8 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl font-bold border border-white/10">
                Rest & Wait (Free - 5m)
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}
