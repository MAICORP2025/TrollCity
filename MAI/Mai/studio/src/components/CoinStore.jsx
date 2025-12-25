import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/authService';
import { supabase } from '../lib/supabase';
import { Coins, Sparkles, Shield, Zap, Gift } from 'lucide-react';
import CoinPackage from './CoinPackage';

const CoinStore = () => {
  const [user, setUser] = useState(null);
  const [purchasingPackage, setPurchasingPackage] = useState(null);

  const coinPackages = [
    { coins: 1000, price: 4.49, popular: false, bestValue: false },
    { coins: 5000, price: 20.99, popular: false, bestValue: false },
    { coins: 12000, price: 49.99, popular: true, bestValue: false },
    { coins: 25000, price: 99.99, popular: false, bestValue: false },
    { coins: 60000, price: 239.99, popular: false, bestValue: true },
    { coins: 120000, price: 459.99, popular: false, bestValue: false },
  ];

  const loadUser = async () => {
    try {
      const userData = await getCurrentUser();
      if (userData) {
        // Fetch user profile with coin balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.id)
          .single();
        setUser({ ...userData, ...profile });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      await loadUser();
    };
    fetchUser();
  }, []);

  const handlePurchase = async (coins, price) => {
    if (!user) {
      alert('Please sign in to purchase coins');
      return;
    }

    setPurchasingPackage(coins);

    // Simulate purchase - in production integrate with payment provider
    alert(`Processing purchase of ${coins.toLocaleString()} MAI Coins for $${price}...`);

    setTimeout(async () => {
      try {
        // Update user coin balance
        const newBalance = (user.coin_balance || 0) + coins;
        await supabase
          .from('profiles')
          .update({ coin_balance: newBalance })
          .eq('id', user.id);

        // Record transaction
        await supabase
          .from('coin_transactions')
          .insert({
            user_id: user.id,
            type: 'purchase',
            amount: coins,
            description: `Purchased ${coins.toLocaleString()} MAI Coins`,
            package_name: `${coins.toLocaleString()} Coins Package`,
            usd_amount: price,
            status: 'completed'
          });

        alert(`Successfully purchased ${coins.toLocaleString()} MAI Coins!`);
        loadUser();
      } catch {
        alert('Purchase failed. Please try again.');
      }
      setPurchasingPackage(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 mb-6">
            <Sparkles className="w-4 h-4 text-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium">MAI Coin Store</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Get <span className="neon-gold">MAI Coins</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Purchase MAI Coins to unlock premium content and support your favorite creators
          </p>

          {/* Current Balance */}
          {user && (
            <div className="mt-8 inline-flex items-center gap-3 px-6 py-3 rounded-full border border-[#FFD700]/30 bg-[#FFD700]/5">
              <Coins className="w-6 h-6 text-[#FFD700]" />
              <span className="text-white">Your Balance:</span>
              <span className="text-2xl font-bold text-[#FFD700]">{(user.coin_balance || 0).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Coin Packages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {coinPackages.map((pkg) => (
            <CoinPackage
              key={pkg.coins}
              coins={pkg.coins}
              price={pkg.price}
              popular={pkg.popular}
              bestValue={pkg.bestValue}
              onPurchase={handlePurchase}
              isLoading={purchasingPackage === pkg.coins}
            />
          ))}
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center card-glow p-6 rounded-xl">
            <Shield className="w-12 h-12 text-[#FFD700] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Secure Payments</h3>
            <p className="text-gray-400">All transactions are processed securely with industry-standard encryption</p>
          </div>
          <div className="text-center card-glow p-6 rounded-xl">
            <Zap className="w-12 h-12 text-[#FF1744] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Instant Delivery</h3>
            <p className="text-gray-400">Coins are added to your account immediately after successful payment</p>
          </div>
          <div className="text-center card-glow p-6 rounded-xl">
            <Gift className="w-12 h-12 text-[#FFD700] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Support Creators</h3>
            <p className="text-gray-400">Your purchases help creators earn from their content and grow the platform</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoinStore;