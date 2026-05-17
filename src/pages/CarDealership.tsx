import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { trollCityTheme } from '../styles/trollCityTheme';
import { toast } from 'sonner';
import { Car, AlertTriangle, ArrowLeft, DollarSign, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCoins } from '../lib/hooks/useCoins';
import { formatCompactNumber } from '../lib/utils';

interface CarCatalogItem {
  id: number;
  name: string;
  tier: string;
  base_price: number;
  exposure_level: number;
  insurance_rate_bps: number;
  registration_fee: number;
  image_url?: string;
  style?: string;
  quantity?: number;
}

export default function CarDealership() {
  const navigate = useNavigate();
  const { troll_coins: balance, refreshCoins } = useCoins();
  const [catalog, setCatalog] = useState<CarCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<string>('valid');
  const [selectedCar, setSelectedCar] = useState<CarCatalogItem | null>(null);
  const [plateType, setPlateType] = useState<'temp' | 'hard'>('temp');
  const { user, refreshProfile } = useAuthStore();

  // Costs for license plate types
  const TEMP_PLATE_FEE = 200;
  const HARD_PLATE_FEE = 2000;

  useEffect(() => {
    if (user) {
      fetchCatalog();
      checkLicenseStatus();
    }
  }, [user]);

  const checkLicenseStatus = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('license_status')
        .eq('id', user.id)
        .maybeSingle();
      
      if (data) setLicenseStatus(data.license_status || 'none');
    } catch (err) {
      console.error('Error checking license:', err);
    }
  };

  const fetchCatalog = async () => {
    try {
      // Query v_dealership_catalog and join with vehicles_catalog to get style
      const { data, error } = await supabase
        .from('v_dealership_catalog')
        .select(`
          id,
          name,
          base_price,
          image_url,
          tier,
          insurance_rate_bps,
          registration_fee,
          exposure_level,
          quantity
        `)
        .gt('quantity', 0)
        .order('base_price', { ascending: true })
        .limit(10);
      
      if (error) {
        console.error('Error fetching cars:', error);
        toast.error('Failed to load showroom');
      } else {
        setCatalog(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to load showroom');
    }
    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!user || !selectedCar) return;

    // Check license status
    if (licenseStatus === 'suspended' || licenseStatus === 'revoked') {
      toast.error(`Cannot purchase vehicle: License is ${licenseStatus}`);
      return;
    }

    if (!licenseStatus || licenseStatus === 'none') {
      toast.error("You need a valid driver's license to purchase a vehicle. Please visit the DMV.");
      return;
    }

    const regFee = selectedCar.registration_fee + (plateType === 'hard' ? HARD_PLATE_FEE : TEMP_PLATE_FEE);
    const totalCost = selectedCar.base_price + regFee;

    if ((balance || 0) < totalCost) {
      toast.error(`Insufficient funds. You need ${formatCompactNumber(totalCost)} coins.`);
      return;
    }

    setPurchasing(true);
    try {
      const { data, error } = await supabase.rpc('purchase_from_ktauto', {
        p_catalog_id: selectedCar.id,
        p_plate_type: plateType
      });

      if (error) throw error;

      if (data && !data.success) {
        toast.error(data.error || data.message || 'Purchase failed');
        return;
      }

       toast.success(`Congratulations! You purchased a ${selectedCar.name}. Check your garage for your new vehicle!`);
       await refreshProfile();
       await refreshCoins();
       setSelectedCar(null);
       await fetchCatalog();
       navigate('/neighborhood-setup');
    } catch (err: any) {
      console.error('Purchase error:', err);
      toast.error(err.message || 'Failed to process purchase');
    } finally {
      setPurchasing(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedCar) return 0;
    const regFee = selectedCar.registration_fee + (plateType === 'hard' ? HARD_PLATE_FEE : TEMP_PLATE_FEE);
    return selectedCar.base_price + regFee;
  };

  const getExposureLabel = (level: number) => {
    switch (level) {
      case 0: return { text: 'Stealth', color: 'text-gray-400' };
      case 1: return { text: 'Low Profile', color: 'text-blue-400' };
      case 2: return { text: 'Noticeable', color: 'text-yellow-400' };
      case 3: return { text: 'High Heat', color: 'text-orange-500' };
      case 4: return { text: 'Most Wanted', color: 'text-red-500' };
      default: return { text: 'Unknown', color: 'text-gray-400' };
    }
  };

  if (loading) return <div className={`p-8 text-center ${trollCityTheme.text.muted}`}>Loading showroom...</div>;

  return (
    <div className={`min-h-screen p-6 pb-24 ${trollCityTheme.backgrounds.primary} ${trollCityTheme.text.primary}`}>
      {/* Background Overlays */}
      <div className={`fixed inset-0 pointer-events-none ${trollCityTheme.overlays.radialPurple}`} />
      <div className={`fixed inset-0 pointer-events-none ${trollCityTheme.overlays.radialPink}`} />
      
      <div className="relative max-w-7xl mx-auto space-y-8">
         {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className={`p-2 rounded-full transition ${trollCityTheme.interactive.hover} hover:bg-white/10`}>
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className={`text-3xl font-bold ${trollCityTheme.gradients.text}`}>
              Exotic Imports Dealership
            </h1>
            <p className={trollCityTheme.text.secondary}>Premium sport cars for the discerning Troller. {catalog.length} vehicles in stock.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalog.length === 0 ? (
            <div className={`col-span-full p-8 text-center rounded-lg border ${trollCityTheme.borders.glass}`}>
              <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className={trollCityTheme.text.muted}>No vehicles in stock at this time.</p>
            </div>
          ) : (
            catalog.map((car) => {
              const exposure = getExposureLabel(car.exposure_level || 4);
              return (
                <div key={car.id} className={`${trollCityTheme.components.card} group !p-0 overflow-hidden`}>
                  {/* Image Placeholder */}
                  <div className={`h-48 ${trollCityTheme.backgrounds.card} flex items-center justify-center relative border-b ${trollCityTheme.borders.glass}`}>
                     {car.image_url ? (
                       <img src={car.image_url} alt={car.name} className="w-full h-full object-cover" />
                     ) : (
                       <Car className={`w-16 h-16 ${trollCityTheme.text.muted} group-hover:text-purple-500 transition`} />
                     )}
                     <div className={`absolute top-2 right-2 ${trollCityTheme.backgrounds.card} px-2 py-1 rounded text-xs border ${trollCityTheme.borders.glass} backdrop-blur-sm`}>
                       {car.tier}
                     </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div>
                      <h3 className={`text-xl font-bold ${trollCityTheme.text.primary}`}>{car.name}</h3>
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <span className={`${exposure.color} font-medium flex items-center gap-1`}>
                           <AlertTriangle className="w-3 h-3" /> {exposure.text}
                        </span>
                      </div>
                    </div>

                    <div className={`space-y-2 text-sm ${trollCityTheme.text.muted} bg-black/20 p-3 rounded-lg border ${trollCityTheme.borders.glass}`}>
                      <div className="flex justify-between">
                        <span>Base Price</span>
                        <span className="text-white font-mono">{formatCompactNumber(car.base_price)} 🪙</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Insurance (Daily)</span>
                        <span className="text-white">{formatCompactNumber((car.base_price * car.insurance_rate_bps / 10000))} 🪙</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Registration</span>
                        <span className="text-white">{formatCompactNumber(car.registration_fee)} 🪙</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedCar(car)}
                      disabled={purchasing}
                      className={`w-full py-3 ${trollCityTheme.gradients.button} rounded-lg font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5`}
                    >
                      <DollarSign className="w-4 h-4" />
                      View Deal
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Purchase Modal with License Plate */}
      {selectedCar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row">
            
            {/* Left: Car Preview */}
            <div className="w-full md:w-2/5 bg-gradient-to-br from-gray-800 to-black p-6 flex flex-col items-center justify-center relative">
               {selectedCar.image_url && (
                 <img 
                   src={selectedCar.image_url} 
                   alt={selectedCar.name} 
                   className="w-full object-contain drop-shadow-xl"
                 />
               )}
               <div className="mt-4 text-center">
                 <h3 className="text-xl font-bold text-white">{selectedCar.name}</h3>
                 <p className="text-sm text-gray-400">{selectedCar.tier} Class</p>
               </div>
            </div>

            {/* Right: Details & Purchase */}
            <div className="w-full md:w-3/5 p-6 flex flex-col relative">
              <button
                onClick={() => setSelectedCar(null)}
                className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex-1 space-y-6">
                
                {/* License Warning */}
                {(!licenseStatus || licenseStatus === 'none' || licenseStatus === 'suspended' || licenseStatus === 'revoked') && (
                   <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-red-200">
                          {(!licenseStatus || licenseStatus === 'none') ? 'No License' : `License ${licenseStatus}`}
                        </h4>
                        <p className="text-xs text-red-200/70">
                          {(!licenseStatus || licenseStatus === 'none') 
                            ? 'You must pass the drivers test at the DMV before purchasing a vehicle.' 
                            : 'You cannot purchase vehicles until your license is restored.'}
                        </p>
                      </div>
                   </div>
                )}

                <div>
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Purchase Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Vehicle Base Price</span>
                      <span className="font-mono text-yellow-400">{formatCompactNumber(selectedCar.base_price)} TC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Registration Fee</span>
                      <span className="font-mono text-yellow-400">{formatCompactNumber(selectedCar.registration_fee)} TC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">License Plate</span>
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
                  </div>
                </div>

                <div className="p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg text-xs text-blue-200 space-y-1">
                  <p className="flex items-center gap-2 font-bold"><Info size={14}/> License Plate Info</p>
                  <ul className="list-disc pl-4 space-y-1 opacity-80">
                    <li><span className="font-semibold">Temp Plate:</span> Expires after 30 days - perfect for testing</li>
                    <li><span className="font-semibold">Hard Plate:</span> Permanent registration - shows in profiles</li>
                    <li>Your plate number will be visible to other players in interactions</li>
                    <li>Plate visible on vehicle when in car view</li>
                  </ul>
                </div>

                <div className="flex justify-between items-end pt-4 border-t border-white/10">
                   <div className="text-sm text-gray-400">Total Due Now</div>
                   <div className="text-2xl font-bold text-yellow-400 font-mono">
                     {formatCompactNumber(calculateTotal())} TC
                   </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => { setSelectedCar(null); }}
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
                      <DollarSign size={18} /> Confirm Purchase
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
