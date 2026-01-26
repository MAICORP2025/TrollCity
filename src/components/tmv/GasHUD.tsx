import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { Fuel, Plus } from 'lucide-react';
import GasStationModal from './GasStationModal';

export default function GasHUD() {
  const { profile } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);

  // Listen for global event to open gas station
  useEffect(() => {
    const handleOpen = () => setModalOpen(true);
    window.addEventListener('open-gas-station', handleOpen);
    return () => window.removeEventListener('open-gas-station', handleOpen);
  }, []);

  if (!profile) return null;

  const gas = profile.gas_balance ?? 100;
  const isLow = gas <= 5;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
         <div className="pointer-events-auto bg-black/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-3 shadow-xl transition-transform hover:scale-105">
            <Fuel className={`w-5 h-5 ${isLow ? 'text-red-500 animate-pulse' : 'text-blue-400'}`} />
            <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
               <div 
                 className={`h-full transition-all duration-500 ${gas > 50 ? 'bg-green-500' : gas > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                 style={{ width: `${Math.max(gas, 0)}%` }}
               />
            </div>
            <span className="text-xs font-bold w-8 text-right text-white">{Math.round(gas)}%</span>
            
            <button 
              onClick={() => setModalOpen(true)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              title="Refill Gas"
            >
              <Plus className="w-4 h-4 text-green-400" />
            </button>
         </div>
      </div>
      
      <GasStationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
