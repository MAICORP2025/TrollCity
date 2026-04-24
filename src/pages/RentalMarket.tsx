import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import { Home, Key, Calendar, ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RentalListing {
  id: string;
  house_catalog_id: string;
  feature_flags: {
    is_for_rent: boolean;
    rent_price: number;
    [key: string]: any;
  };
  condition: number;
  catalog?: {
    name: string;
    tier: number;
    power_band: string;
  };
}

interface MyRental {
  id: string;
  rent_amount: number;
  next_due_at: string;
  status: string;
  house?: {
    house_catalog_id: string;
  };
  catalog?: {
    name: string;
  };
}

export default function RentalMarket() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [listings, setListings] = useState<RentalListing[]>([]);
  const [myRental, setMyRental] = useState<MyRental | null>(null);
  const [loading, setLoading] = useState(true);
  const [rentingId, setRentingId] = useState<string | null>(null);

  const fetchMarketData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch My Active Rental
      const { data: rentalData } = await supabase
        .from('house_rentals')
        .select(`
          *,
          house:user_houses(
            house_catalog_id
          )
        `)
        .eq('tenant_user_id', user.id)
        .in('status', ['active', 'late'])
        .maybeSingle();

      if (rentalData) {
        // Fetch catalog info separately or join if possible (complex join might need views)
        // Let's just fetch catalog info for the house
        const { data: catData } = await supabase
          .from('houses_catalog')
          .select('name')
          .eq('id', rentalData.house.house_catalog_id)
          .single();
        
        setMyRental({ ...rentalData, catalog: catData });
      } else {
        setMyRental(null);
      }

      // 2. Fetch Listings
      // We need to join with catalog to get names
      // Since supabase-js join syntax is tricky with nested relations on the fly without foreign keys set up perfectly for every hop,
      // we'll fetch houses then catalog.
      // But wait, user_houses has house_catalog_id.
      
      const { data: houses, error: housesError } = await supabase
        .from('user_houses')
        .select(`
          id,
          house_catalog_id,
          feature_flags,
          condition,
          catalog:houses_catalog(name, tier, power_band)
        `)
        .eq('feature_flags->>is_for_rent', 'true')
        .neq('user_id', user.id); // Don't show my own houses (I can't rent from myself)

      if (housesError) throw housesError;
      const formattedListings = houses?.map(h => ({ ...h, catalog: h.catalog?.[0] })) || [];
      setListings(formattedListings);

    } catch (error) {
      console.error('Error fetching market:', error);
      toast.error('Failed to load rental market');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  const handleRent = async (listing: RentalListing) => {
    if (!user) return;
    if (myRental) {
      toast.error("You already have a rental! Leave it first.");
      return;
    }

    const price = listing.feature_flags.rent_price;
    if (!confirm(`Rent ${listing.catalog?.name} for ${price.toLocaleString()} coins/week?`)) return;

    setRentingId(listing.id);
    try {
      const { data, error } = await supabase.rpc('rent_property', {
        p_user_house_id: listing.id
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Welcome home! Rental active.');
        fetchMarketData(); // Refresh
      } else {
        toast.error(data.error || 'Rental failed');
      }
    } catch (err: any) {
      console.error('Rent error:', err);
      toast.error(err.message || 'Failed to rent property');
    } finally {
      setRentingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading market...</div>;

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6 pb-24">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/active-assets')} className="p-2 hover:bg-white/10 rounded-full transition">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
              Rental Market
            </h1>
            <p className="text-gray-400">Find a place to stay. Pay weekly. Don&apos;t get evicted.</p>
          </div>
        </div>

        {/* My Current Rental */}
        {myRental && (
          <div className="bg-[#151520] border border-emerald-500/30 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Key className="w-32 h-32 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="text-emerald-500" /> Current Residence
            </h2>
            <div className="space-y-2 relative z-10">
              <div className="text-2xl font-bold">{myRental.catalog?.name || 'Unknown Property'}</div>
              <div className="text-gray-400">Rent: <span className="text-white">{myRental.rent_amount.toLocaleString()}</span> / week</div>
              <div className="text-gray-400">Next Due: <span className="text-white">{new Date(myRental.next_due_at).toLocaleDateString()}</span></div>
              <div className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase ${
                myRental.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {myRental.status}
              </div>
            </div>
          </div>
        )}

        {/* Listings */}
        <div>
          <h2 className="text-xl font-bold mb-6 text-gray-300">Available Properties</h2>
          
          {listings.length === 0 ? (
            <div className="text-center py-12 bg-[#151520] rounded-xl border border-[#2C2C2C] border-dashed text-gray-500">
              <Home className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No properties listed for rent right now.</p>
              <p className="text-sm mt-2">Check back later or buy your own!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {listings.map((item) => (
                <div key={item.id} className="bg-[#151520] border border-[#2C2C2C] rounded-xl p-5 hover:border-emerald-500/50 transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold">{item.catalog?.name}</h3>
                      <div className="text-sm text-emerald-400">{item.catalog?.power_band}</div>
                    </div>
                    <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg font-mono font-bold">
                      {item.feature_flags.rent_price.toLocaleString()} 🪙
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
                    <span className="flex items-center gap-1">
                      <Home className="w-4 h-4" /> Tier {item.catalog?.tier}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" /> Weekly
                    </span>
                  </div>

                  <button
                    onClick={() => handleRent(item)}
                    disabled={!!myRental || rentingId === item.id}
                    className="w-full py-2 bg-[#2C2C2C] hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition flex items-center justify-center gap-2"
                  >
                    {rentingId === item.id ? 'Signing Lease...' : myRental ? 'Already Renting' : 'Rent Now'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
