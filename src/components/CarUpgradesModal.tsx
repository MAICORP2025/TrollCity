import React, { useEffect, useState, useCallback } from 'react';
import { X, Wrench, ArrowUp, Coins, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface CarUpgradesModalProps {
  userCarId: string;
  onClose: () => void;
  onUpdate: () => void;
}

interface Upgrade {
  id: string;
  name: string;
  type: string; // 'engine', 'transmission', 'tires', 'body', 'nitro'
  cost: number;
  value_increase_amount: number;
  description: string;
  tier: number;
}

interface UserUpgrade {
  id: string;
  upgrade_id: string;
  upgrade: Upgrade;
}

export default function CarUpgradesModal({ userCarId, onClose, onUpdate }: CarUpgradesModalProps) {
  const [availableUpgrades, setAvailableUpgrades] = useState<Upgrade[]>([]);
  const [installedUpgrades, setInstalledUpgrades] = useState<UserUpgrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all available upgrades
      const { data: upgradesData, error: upgradesError } = await supabase
        .from('car_upgrades')
        .select('*')
        .order('cost', { ascending: true });

      if (upgradesError) throw upgradesError;

      // Fetch installed upgrades for this vehicle
      const { data: installedData, error: installedError } = await supabase
        .from('user_vehicle_upgrades')
        .select('*, upgrade:car_upgrades(*)')
        .eq('user_vehicle_id', userCarId);

      if (installedError) throw installedError;

      setAvailableUpgrades(upgradesData || []);
      setInstalledUpgrades(installedData || []);
    } catch (error) {
      console.error('Error loading upgrades:', error);
      toast.error('Failed to load upgrades');
    } finally {
      setLoading(false);
    }
  }, [userCarId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchase = async (upgrade: Upgrade) => {
    // Check if already installed
    const isInstalled = installedUpgrades.some(u => u.upgrade_id === upgrade.id);
    if (isInstalled) return;

    setPurchasing(upgrade.id);
    try {
      const { error, data } = await supabase.rpc('apply_vehicle_upgrade', {
        p_vehicle_id: userCarId,
        p_upgrade_id: upgrade.id
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.message);

      toast.success(`Purchased ${upgrade.name}!`);
      await loadData();
      onUpdate(); // Refresh parent to update value
    } catch (error: any) {
      console.error('Purchase failed:', error);
      toast.error(error.message || 'Failed to purchase upgrade');
    } finally {
      setPurchasing(null);
    }
  };

  const categories = ['engine', 'transmission', 'tires', 'body', 'nitro'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">Vehicle Upgrades</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          ) : (
            categories.map(category => {
              const categoryUpgrades = availableUpgrades.filter(u => u.type === category);
              if (categoryUpgrades.length === 0) return null;

              return (
                <div key={category} className="space-y-3">
                  <h3 className="text-sm font-bold uppercase text-zinc-500 tracking-wider flex items-center gap-2">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {categoryUpgrades.map(upgrade => {
                      const isInstalled = installedUpgrades.some(u => u.upgrade_id === upgrade.id);
                      
                      return (
                        <div key={upgrade.id} className={`p-3 rounded-xl border ${isInstalled ? 'bg-emerald-900/10 border-emerald-500/50' : 'bg-zinc-800/50 border-zinc-700'} flex flex-col gap-2 transition-all hover:border-zinc-600`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className={`font-bold ${isInstalled ? 'text-emerald-400' : 'text-white'}`}>{upgrade.name}</h4>
                              <p className="text-xs text-zinc-400">{upgrade.description}</p>
                            </div>
                            {isInstalled && <div className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded uppercase font-bold">Installed</div>}
                          </div>
                          
                          <div className="mt-2 flex items-center justify-between">
                             <div className="text-xs text-emerald-400 flex items-center gap-1">
                               <ArrowUp className="w-3 h-3" />
                               Value +{upgrade.value_increase_amount?.toLocaleString() || 0}
                             </div>
                             
                             {!isInstalled && (
                               <button
                                 onClick={() => handlePurchase(upgrade)}
                                 disabled={purchasing === upgrade.id}
                                 className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                               >
                                 {purchasing === upgrade.id ? (
                                   <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                 ) : (
                                   <>
                                     <Coins className="w-3 h-3" />
                                     {upgrade.cost.toLocaleString()}
                                   </>
                                 )}
                               </button>
                             )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          
          {!loading && availableUpgrades.length === 0 && (
             <div className="text-center py-10 text-zinc-500">
               <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
               <p>No upgrades available at the moment.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
