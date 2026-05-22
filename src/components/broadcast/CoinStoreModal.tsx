import { useState, useEffect, useCallback } from 'react';
import { X, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import PayPalPaymentModal from './PayPalPaymentModal'

interface CoinPackage {
  id: string;
  coins: number;
  baseCoins?: number;
  bonusCoins?: number;
  price: string;
  popular?: boolean;
}

interface CoinStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export default function CoinStoreModal({ isOpen, onClose, embedded = false }: CoinStoreModalProps) {
  const { user, profile } = useAuthStore();
  const [selectedPack, setSelectedPack] = useState<CoinPackage | null>(null);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New user state - check if user has made any previous coin purchases
  const [isNewUser, setIsNewUser] = useState(true);
  const [checkingNewUser, setCheckingNewUser] = useState(true);
  const NEW_USER_COIN_DISCOUNT = 0.05; // 5% off for new users
  const MINIMUM_TAX_RATE = 0.03; // 3% minimum tax on all coin packs

  const [showPayPalPayment, setShowPayPalPayment] = useState(false);
  const [showCardPayment, setShowCardPayment] = useState(false);

  // Check if user is a new user (less than 1 week on platform)
  const checkNewUserStatus = useCallback(async () => {
    if (!user?.id) {
      setCheckingNewUser(false);
      return;
    }
    
    try {
      // Check user's account creation date
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('created_at')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (profileData?.created_at) {
        const createdAt = new Date(profileData.created_at);
        const now = new Date();
        const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        
        // User is "new" if less than 7 days since account creation
        setIsNewUser(daysSinceCreation < 7);
      } else {
        setIsNewUser(false);
      }
    } catch (err) {
      console.error('Error checking new user status:', err);
      // Default to false on error to avoid giving discount incorrectly
      setIsNewUser(false);
    } finally {
      setCheckingNewUser(false);
    }
  }, [user?.id]);

   const fetchCoinPacks = async () => {
     setLoading(true);
     
     // Standard coin packs for broadcast quick store
     const basePacks = [
       { id: '1', coins: 100, price: '$1.00' },
       { id: '2', coins: 300, price: '$3.00' },
       { id: '3', coins: 500, price: '$5.00' },
       { id: '4', coins: 1000, price: '$10.00', popular: true },
       { id: '5', coins: 2500, price: '$25.00' },
       { id: '6', coins: 5000, price: '$50.00' },
       { id: '7', coins: 10000, price: '$100.00' },
     ];
    const standardPacks: CoinPackage[] = basePacks.map((pkg) => {
      const bonusCoins = Math.floor(pkg.coins * 0.10);
      return {
        ...pkg,
        baseCoins: pkg.coins,
        bonusCoins,
        coins: pkg.coins + bonusCoins,
      };
    });
    
    setPackages(standardPacks);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchCoinPacks();
      checkNewUserStatus();
      // Reset state when opening
      setSelectedPack(null);
      setShowPayPalPayment(false);
    }
  }, [isOpen, checkNewUserStatus]);

  const handlePackageSelect = (pkg: CoinPackage) => {
    const finalPrice = getFinalPrice(pkg.price);
    const pkgWithTax = {
      ...pkg,
      price: finalPrice.toFixed(2),
      purchaseType: 'coins',
      metadata: { source: 'broadcast_quick_store', baseCoins: pkg.baseCoins, bonusCoins: pkg.bonusCoins },
    };
    setSelectedPack(pkgWithTax);
    setShowPayPalPayment(true);
  };

  const handleCardCheckout = (pkg: CoinPackage) => {
    const finalPrice = getFinalPrice(pkg.price);
    const pkgWithTax: any = {
      ...pkg,
      price: finalPrice.toFixed(2),
      purchaseType: 'coins',
      metadata: { source: 'broadcast_quick_store', baseCoins: pkg.baseCoins, bonusCoins: pkg.bonusCoins },
      forceCard: true,
    };
    setSelectedPack(pkgWithTax);
    setShowCardPayment(true);
  };

  // Helper to calculate final price with minimum tax
  const getFinalPrice = (price: string) => {
    const numPrice = parseFloat(price.replace('$', ''));
    if (isNaN(numPrice)) return 0;
    const tax = numPrice * MINIMUM_TAX_RATE;
    return numPrice + tax;
  };

  const getTaxAmount = (price: string) => {
    const numPrice = parseFloat(price.replace('$', ''));
    if (isNaN(numPrice)) return 0;
    return numPrice * MINIMUM_TAX_RATE;
  };

  const getDisplayPrice = (price: string) => {
    const numPrice = parseFloat(price.replace('$', ''));
    if (isNaN(numPrice)) return price;
    const discounted = numPrice * (1 - NEW_USER_COIN_DISCOUNT);
    const withTax = discounted + (discounted * MINIMUM_TAX_RATE);
    return `$${withTax.toFixed(2)}`;
  };
  
  const handlePaymentSuccess = (data: any) => {
    toast.success(`Successfully purchased ${selectedPack?.coins.toLocaleString()} coins!`);
    setShowPayPalPayment(false);
    setSelectedPack(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className={embedded ? "h-full w-full" : "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"}>
        <div className={embedded ? "relative h-full w-full bg-zinc-900 overflow-hidden" : "relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-400" />
              Coin Store
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* New User Discount Banner */}
          {isNewUser && !checkingNewUser && (
            <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40 rounded-lg animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-center gap-2 text-green-400">
                <span className="text-lg">🎉</span>
                <span className="font-bold">New User Special: 5% OFF + 3% Tax Included!</span>
                <span className="text-lg">🎉</span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-zinc-400">Loading packs...</div>
            ) : (
            <div className="grid grid-cols-1 gap-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => handlePackageSelect(pkg)}
                  className={`group relative flex items-center justify-between p-4 rounded-lg border transition-all duration-200
                    ${selectedPack?.id === pkg.id 
                      ? 'bg-yellow-500/10 border-yellow-500/50' 
                      : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600'
                    }
                  `}
                >
                  {pkg.popular && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                      BEST VALUE
                    </div>
                  )}
                  {/* 5% OFF badge for new users */}
                  {isNewUser && !checkingNewUser && (
                    <div className="absolute -top-2 -right-1 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-pulse">
                      5% OFF
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${selectedPack?.id === pkg.id ? 'bg-yellow-500/20' : 'bg-zinc-700'}`}>
                      <Coins className={`w-5 h-5 ${selectedPack?.id === pkg.id ? 'text-yellow-400' : 'text-zinc-400 group-hover:text-yellow-400'}`} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-white text-lg">{pkg.coins.toLocaleString()} Coins</div>
                      <div className="text-xs text-emerald-300">Includes {pkg.bonusCoins?.toLocaleString()} bonus coins</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`font-bold bg-zinc-950 px-3 py-1 rounded-md border border-zinc-800 ${isNewUser ? 'text-green-400' : 'text-white'}`}>
                      {isNewUser ? getDisplayPrice(pkg.price) : getFinalPrice(pkg.price)}
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      +${(isNewUser ? getTaxAmount(pkg.price) : getTaxAmount(pkg.price)).toFixed(2)} tax
                    </span>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePackageSelect(pkg); }}
                        className="px-3 py-1 bg-cyan-600 text-black font-bold rounded-md text-sm"
                      >
                        PayPal
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCardCheckout(pkg); }}
                        className="px-3 py-1 bg-zinc-800 text-white rounded-md text-sm border border-zinc-700"
                      >
                        Credit Card
                      </button>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            )}
            
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200 text-center">
              Secure payments processed via PayPal. Broadcast quick-store packs include 10% extra coins.
            </div>
          </div>
        </div>
      </div>

      <PayPalPaymentModal
        isOpen={showPayPalPayment || showCardPayment}
        onClose={() => {
          setShowPayPalPayment(false);
          setShowCardPayment(false);
          setSelectedPack(null);
        }}
        pkg={selectedPack}
        userId={user?.id || ''}
        profile={profile}
        onPaymentSuccess={handlePaymentSuccess}
        onSaveCard={true}
      />
    </>
  );
}
