import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Car, AlertTriangle, ArrowLeft, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CarCatalogItem {
  id: string;
  name: string;
  tier: number;
  base_price: number;
  exposure_level: number;
  insurance_rate_bps: number;
  registration_fee: number;
  image_url?: string;
  feature_flags: any;
}

export default function CarDealership() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<CarCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    const { data, error } = await supabase
      .from('cars_catalog')
      .select('*')
      .order('base_price', { ascending: true });
    
    if (error) {
      console.error('Error fetching cars:', error);
      toast.error('Failed to load showroom');
    } else {
      setCatalog(data || []);
    }
    setLoading(false);
  };

  const handlePurchase = async (car: CarCatalogItem) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to purchase the ${car.name} for ${car.base_price.toLocaleString()} coins?`)) return;

    setPurchasing(car.id);
    try {
      const { data, error } = await supabase.rpc('purchase_car', {
        p_car_catalog_id: car.id
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Congratulations! You purchased a ${car.name}.`);
        navigate('/active-assets'); // Redirect to garage
      } else {
        toast.error(data.error || 'Purchase failed');
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      toast.error(err.message || 'Failed to process purchase');
    } finally {
      setPurchasing(null);
    }
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

  if (loading) return <div className="p-8 text-center text-gray-400">Loading showroom...</div>;

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6 pb-24">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/active-assets')} className="p-2 hover:bg-white/10 rounded-full transition">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Exotic Imports Dealership
            </h1>
            <p className="text-gray-400">High-performance machines for the discerning Troller.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {catalog.map((car) => {
            const exposure = getExposureLabel(car.exposure_level);
            return (
              <div key={car.id} className="bg-[#151520] border border-[#2C2C2C] rounded-xl overflow-hidden hover:border-purple-500/50 transition group">
                {/* Image Placeholder */}
                <div className="h-48 bg-[#1A1A25] flex items-center justify-center relative">
                   {car.image_url ? (
                     <img src={car.image_url} alt={car.name} className="w-full h-full object-cover" />
                   ) : (
                     <Car className="w-16 h-16 text-gray-600 group-hover:text-purple-500 transition" />
                   )}
                   <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs border border-white/10">
                     Tier {car.tier}
                   </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">{car.name}</h3>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <span className={`${exposure.color} font-medium flex items-center gap-1`}>
                         <AlertTriangle className="w-3 h-3" /> {exposure.text}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-400 bg-black/20 p-3 rounded-lg">
                    <div className="flex justify-between">
                      <span>Base Price</span>
                      <span className="text-white font-mono">{car.base_price.toLocaleString()} 🪙</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Insurance (Daily)</span>
                      <span className="text-white">{(car.base_price * car.insurance_rate_bps / 10000).toFixed(0)} 🪙</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Registration</span>
                      <span className="text-white">{car.registration_fee.toLocaleString()} 🪙</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(car)}
                    disabled={purchasing === car.id}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-bold transition flex items-center justify-center gap-2"
                  >
                    {purchasing === car.id ? (
                      <span className="animate-pulse">Processing...</span>
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4" />
                        Purchase
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
