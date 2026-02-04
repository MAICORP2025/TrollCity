import React, { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { cars, Car } from '../../data/vehicles';
import { toast } from 'sonner';
import { Info, Car as CarIcon, DollarSign, CreditCard, AlertTriangle } from 'lucide-react';
import { formatCompactNumber } from '../../lib/utils';
import { useCoins } from '../../lib/hooks/useCoins';

export default function KTAuto() {
  const { user } = useAuthStore();
  const { troll_coins: balance, refreshCoins } = useCoins();
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [plateType, setPlateType] = useState<'temp' | 'hard'>('temp');
  const [purchasing, setPurchasing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  
  // New State for Loans & License
  const [useLoan, setUseLoan] = useState(false);
  const [creditScore, setCreditScore] = useState<number>(0);
  const [licenseStatus, setLicenseStatus] = useState<string>('valid');

  // Costs
  const TEMP_PLATE_FEE = 200;
  const HARD_PLATE_FEE = 2000;
  const TITLE_FEE = 500;

  React.useEffect(() => {
    if (!user) return;
    
    const checkUserStatus = async () => {
      try {
        // Check Credit
        const { data: creditData } = await supabase
          .from('user_credit')
          .select('score')
          .eq('user_id', user.id)
          .single();
        
        if (creditData) setCreditScore(creditData.score);

        // Check License
        const { data: licenseData } = await supabase
          .from('user_driver_licenses')
          .select('status')
          .eq('user_id', user.id)
          .single();
          
        if (licenseData) setLicenseStatus(licenseData.status);
      } catch (err) {
        console.error('Error checking user status:', err);
      }
    };
    
    checkUserStatus();
  }, [user]);

  const filteredCars = useMemo(() => {
    if (filter === 'all') return cars;
    return cars.filter(c => c.tier.toLowerCase().includes(filter.toLowerCase()));
  }, [filter]);

  const categories = ['all', 'Starter', 'Mid', 'Luxury', 'Super', 'Elite', 'Street', 'Legendary'];

  const handlePurchase = async () => {
    if (!user || !selectedCar) return;
    
    if (licenseStatus === 'suspended' || licenseStatus === 'revoked') {
      toast.error(`Cannot purchase vehicle: License is ${licenseStatus}`);
      return;
    }

    const regFee = plateType === 'hard' ? HARD_PLATE_FEE : TEMP_PLATE_FEE;
    let upfrontCost = selectedCar.price + TITLE_FEE + regFee;

    if (useLoan) {
      if (creditScore <= 650) {
        toast.error("Credit score must be > 650 for instant loan approval.");
        return;
      }
      // 10% Down Payment + Fees
      const downPayment = Math.floor(selectedCar.price * 0.10);
      upfrontCost = downPayment + TITLE_FEE + regFee;
    }

    if ((balance || 0) < upfrontCost) {
      toast.error(`Insufficient funds. You need ${formatCompactNumber(upfrontCost)} coins.`);
      return;
    }

    setPurchasing(true);
    try {
      const { data, error } = await supabase.rpc('purchase_from_ktauto', {
        p_catalog_id: selectedCar.id,
        p_plate_type: plateType,
        p_use_loan: useLoan
      });

      if (error) throw error;

      if (data && !data.success) {
        toast.error(data.message);
        return;
      }

      // Add to 3D Scene
      const newCar = {
        id: data.vehicle_id,
        model: selectedCar.name,
        color: '#3b82f6', // Default new car color
        position: [Math.random() * 20 - 10, 0, Math.random() * 20 - 10] as [number, number, number],
        rotation: 0,
        isOwned: true
      };
      // @ts-expect-error: window.addCar is not typed
      if (window.addCar) window.addCar(newCar);

      toast.success(`Successfully purchased ${selectedCar.name}!`);
      setSelectedCar(null);
      setUseLoan(false);
      refreshCoins();
    } catch (err: any) {
      console.error('Purchase failed:', err);
      toast.error(err.message || 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedCar) return 0;
    const regFee = plateType === 'hard' ? HARD_PLATE_FEE : TEMP_PLATE_FEE;
    const fees = TITLE_FEE + regFee;
    
    if (useLoan) {
      const downPayment = Math.floor(selectedCar.price * 0.10);
      return downPayment + fees;
    }
    return selectedCar.price + fees;
  };


  return (
    <div className="space-y-6">
      {/* Header / Intro */}
      <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <CarIcon className="text-blue-400" /> KTAuto Dealership
            </h2>
            <p className="text-blue-200/70 text-sm mt-1">
              The premier destination for Troll City vehicles. All sales final. Coins only.
            </p>
          </div>
          <div className="flex gap-2">
            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2 justify-end">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === cat 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-black/30 text-blue-300 hover:bg-blue-500/20'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredCars.map(car => (
          <div 
            key={car.id}
            className="group bg-black/40 border border-white/10 rounded-xl overflow-hidden hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-900/20 flex flex-col"
          >
            {/* Image Area */}
            <div className="relative aspect-[16/9] bg-gradient-to-b from-gray-800 to-black p-4 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <img 
                src={car.image} 
                alt={car.name}
                className="w-full h-full object-contain drop-shadow-2xl transform group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-blue-300 border border-white/10">
                {car.tier}
              </div>
            </div>

            {/* Info Area */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">{car.name}</h3>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{car.style}</p>
                
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                    Speed: {car.speed}
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Armor: {car.armor}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <div className="text-yellow-400 font-mono font-bold text-lg">
                  {formatCompactNumber(car.price)} <span className="text-xs text-yellow-600">TC</span>
                </div>
                <button
                  onClick={() => setSelectedCar(car)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  View Deal
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Modal */}
      {selectedCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row">
            
            {/* Left: Car Preview */}
            <div className="w-full md:w-2/5 bg-gradient-to-br from-gray-800 to-black p-6 flex flex-col items-center justify-center relative">
               <img 
                 src={selectedCar.image} 
                 alt={selectedCar.name} 
                 className="w-full object-contain drop-shadow-xl"
               />
               <div className="mt-4 text-center">
                 <h3 className="text-xl font-bold text-white">{selectedCar.name}</h3>
                 <p className="text-sm text-gray-400">{selectedCar.tier} Class</p>
               </div>
            </div>

            {/* Right: Details & Purchase */}
            <div className="w-full md:w-3/5 p-6 flex flex-col">
              <div className="flex-1 space-y-6">
                
                {/* License Warning */}
                {(licenseStatus === 'suspended' || licenseStatus === 'revoked') && (
                   <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-red-200">License {licenseStatus}</h4>
                        <p className="text-xs text-red-200/70">You cannot purchase vehicles until your license is restored.</p>
                      </div>
                   </div>
                )}

                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Purchase Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Vehicle Base Price</span>
                      <span className="font-mono text-yellow-400">{selectedCar.price.toLocaleString()} TC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Title Issue Fee</span>
                      <span className="font-mono text-yellow-400">{TITLE_FEE.toLocaleString()} TC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Registration (Plate)</span>
                      <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                        <button
                          onClick={() => setPlateType('temp')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            plateType === 'temp' ? 'bg-zinc-700 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Temp ({TEMP_PLATE_FEE})
                        </button>
                        <button
                          onClick={() => setPlateType('hard')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            plateType === 'hard' ? 'bg-zinc-700 text-white' : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Hard ({HARD_PLATE_FEE})
                        </button>
                      </div>
                    </div>

                    {/* Loan Option */}
                    {creditScore > 650 && (
                      <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-2">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-emerald-400" />
                          <span className="text-gray-300">Instant Loan (10% Down)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={useLoan} 
                            onChange={(e) => setUseLoan(e.target.checked)} 
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>
                    )}
                    
                    {useLoan && (
                      <div className="text-xs text-emerald-400/80 pl-6">
                        Paying {Math.floor(selectedCar.price * 0.10).toLocaleString()} TC down + Fees. Remainder financed.
                      </div>
                    )}

                  </div>
                </div>

                <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg text-xs text-blue-200 space-y-1">
                  <p className="flex items-center gap-2 font-bold"><Info size={14}/> Important Info</p>
                  <ul className="list-disc pl-4 space-y-1 opacity-80">
                    <li>Sales are final. No refunds.</li>
                    <li>Insurance required for street legality (2,000 TC/mo).</li>
                    <li>Max 25 car purchases per month.</li>
                  </ul>
                </div>

                <div className="flex justify-between items-end pt-4 border-t border-white/10">
                   <div className="text-sm text-gray-400">Total Due Now</div>
                   <div className="text-2xl font-bold text-yellow-400 font-mono">
                     {calculateTotal().toLocaleString()} TC
                   </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setSelectedCar(null); setUseLoan(false); }}
                  disabled={purchasing}
                  className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={purchasing || (licenseStatus === 'suspended' || licenseStatus === 'revoked')}
                  className="flex-[2] px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/30 disabled:opacity-50 flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                >
                  {purchasing ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <DollarSign size={18} /> {useLoan ? 'Finance Purchase' : 'Confirm Purchase'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
