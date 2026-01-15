import React, { useState } from 'react';
import { Wrench, Zap, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import { deductCoins } from '../../lib/coinTransactions';
import { toast } from 'sonner';
import VehicleRenderer from '../../components/game/VehicleRenderer';

export default function MechanicShopPage() {
  const { user, profile } = useAuthStore();
  const [repairing, setRepairing] = useState<'quick' | 'full' | null>(null);

  const handleRepair = async (mode: 'quick' | 'full') => {
    if (!user || !profile) {
      toast.error('You must be logged in');
      return;
    }

    const price = mode === 'quick' ? 500 : 2500;
    if ((profile.troll_coins || 0) < price) {
      toast.error('Not enough troll coins');
      return;
    }

    setRepairing(mode);
    try {
      const result = await deductCoins({
        userId: user.id,
        amount: price,
        type: 'purchase',
        description: mode === 'quick' ? 'Quick vehicle repair' : 'Total vehicle overhaul',
        metadata: { source: 'mechanic_shop', mode }
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to repair vehicle');
        return;
      }

      toast.success(mode === 'quick' ? 'Vehicle repaired' : 'Vehicle fully restored');
      localStorage.setItem(`trollcity_vehicle_condition_${user.id}`, JSON.stringify({ status: 'good' }));
    } finally {
      setRepairing(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pt-24 pb-20">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex items-center gap-4">
          <div className="p-4 bg-yellow-600/20 rounded-2xl border border-yellow-500/30">
            <Wrench size={32} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Grease Monkey Garage
            </h1>
            <p className="text-gray-400">If it's broke, we might fix it.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Vehicle Display */}
          <div className="md:col-span-2 bg-zinc-900 rounded-xl p-6 border border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Vehicle in Shop</h2>
              <p className="text-gray-400 text-sm">
                {profile?.active_vehicle ? 'Ready for service' : 'No vehicle selected'}
              </p>
            </div>
            {profile?.active_vehicle ? (
               <div className="h-32 w-48 relative">
                 <VehicleRenderer 
                   vehicleId={profile.active_vehicle} 
                   className="w-full h-full object-contain"
                   showShadow={true}
                 />
               </div>
            ) : (
              <div className="h-24 w-40 bg-zinc-800/50 rounded-lg flex items-center justify-center text-zinc-600 text-sm">
                No Vehicle
              </div>
            )}
          </div>

          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <div className="flex items-center gap-3 mb-4">
              <Zap size={24} className="text-yellow-400" />
              <h2 className="text-xl font-bold">Quick Fix</h2>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Instant repair for minor damages. Gets you back on the road in no time.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-yellow-400">500 Coins</span>
              <button
                onClick={() => handleRepair('quick')}
                disabled={repairing === 'quick'}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {repairing === 'quick' ? 'Processing...' : 'Repair Now'}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
             <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-red-400" />
              <h2 className="text-xl font-bold">Total Overhaul</h2>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Complete restoration for wrecked vehicles. Required after heavy raid damage.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-red-400">2,500 Coins</span>
              <button
                onClick={() => handleRepair('full')}
                disabled={repairing === 'full'}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {repairing === 'full' ? 'Processing...' : 'Full Restore'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
