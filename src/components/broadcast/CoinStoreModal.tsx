import { X, ShoppingCart, Shield, Zap, Coins as CoinsIcon, Sparkles, Smartphone } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import { useAuthStore } from "../../lib/store";
import { ENTRANCE_EFFECTS_CONFIG } from "../../lib/entranceEffects";
import CashAppPaymentModal from "./CashAppPaymentModal";

interface CoinPackage {
  id: number;
  coins: number;
  price: string;
  emoji: string;
  popular?: boolean;
  bestValue?: boolean;
}

const coinPackages: CoinPackage[] = [
  { id: 0, coins: 1, price: "$0.00", emoji: "🪙" },
  { id: 1, coins: 100, price: "$0.75", emoji: "🪙" },
  { id: 2, coins: 500, price: "$4.99", emoji: "💰", popular: true },
  { id: 3, coins: 1000, price: "$9.99", emoji: "💎" },
  { id: 4, coins: 2500, price: "$19.99", emoji: "👑" },
  { id: 5, coins: 5000, price: "$39.99", emoji: "🚀" },
  { id: 6, coins: 10000, price: "$69.99", emoji: "⭐", bestValue: true },
];

interface CoinStoreModalProps {
  onClose: () => void;
  onPurchase?: (coins: number) => void;
}

export default function CoinStoreModal({
  onClose,
  onPurchase,
}: CoinStoreModalProps) {
  const { profile, refreshProfile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'coins' | 'perks' | 'insurance' | 'effects'>('coins');
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [perks, setPerks] = useState<any[]>([]);
  const [insuranceOptions, setInsuranceOptions] = useState<any[]>([]);
  const [ownedEffects, setOwnedEffects] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [cashAppModalOpen, setCashAppModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'cashapp'>('stripe');

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data: p } = await supabase.from('perks').select('*').eq('is_active', true);
      const { data: i } = await supabase.from('insurance_options').select('*').eq('is_active', true);
      if (p) setPerks(p);
      if (i) {
        const filteredInsurance = i.filter((opt: any) => opt.protection_type !== 'bankrupt');
        setInsuranceOptions(filteredInsurance);
      }

      if (profile) {
        const { data: effects } = await supabase
          .from('user_entrance_effects')
          .select('effect_id')
          .eq('user_id', profile.id);
        
        if (effects) {
          setOwnedEffects(new Set(effects.map(e => e.effect_id)));
        }
      }
    };
    fetchCatalog();
  }, [profile]);

  const handleCoinPurchase = () => {
    if (!selectedPackage) return;
    onPurchase?.(selectedPackage.coins);
    toast.success(`Purchased ${selectedPackage.coins} coins!`);
    setSelectedPackage(null);
  };

  const handleItemPurchase = async (item: any, type: 'perk' | 'insurance' | 'effect') => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !profile) {
        toast.error('You must be logged in');
        return;
      }

      if ((profile.troll_coins || 0) < item.cost) {
        toast.error(`Not enough coins! You need ${item.cost - (profile.troll_coins || 0)} more.`);
        return;
      }

      // Deduct coins first
      const { error: deductionError } = await supabase.rpc('decrement_coins', {
        amount: item.cost,
        row_id: user.id
      });

      if (deductionError) {
        // Fallback to manual update if RPC fails or doesn't exist
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ troll_coins: (profile.troll_coins || 0) - item.cost })
          .eq('id', user.id);
        
        if (updateError) throw updateError;
      }

      if (type === 'perk') {
        const { error } = await supabase.from('user_perks').insert({
          user_id: user.id,
          perk_id: item.id,
          expires_at: new Date(Date.now() + item.duration_minutes * 60000).toISOString()
        });
        if (error) throw error;
        toast.success(`Purchased perk: ${item.name}`);
      } else if (type === 'insurance') {
        const { error } = await supabase.from('user_insurances').insert({
          user_id: user.id,
          insurance_id: item.id,
          expires_at: new Date(Date.now() + item.duration_hours * 3600000).toISOString(),
          protection_type: item.protection_type
        });
        if (error) throw error;
        toast.success(`Purchased insurance: ${item.name}`);
      } else if (type === 'effect') {
        const { error } = await supabase.from('user_entrance_effects').insert({
          user_id: user.id,
          effect_id: item.id,
          acquired_at: new Date().toISOString()
        });
        if (error) throw error;
        setOwnedEffects(prev => new Set([...prev, item.id]));
        toast.success(`Purchased effect: ${item.name}`);
      }

      await refreshProfile();
    } catch (e: any) {
      console.error('Purchase failed', e);
      if (e.code === '23505') {
        toast.error('You already own this item!');
      } else {
        toast.error('Purchase failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg p-6 max-w-2xl w-full purple-neon max-h-[80vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={24} className="text-yellow-400" />
            <h2 className="text-xl font-bold">STORE</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
          <button
            onClick={() => setActiveTab('coins')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
              activeTab === 'coins' ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CoinsIcon size={18} /> Coins
          </button>
          <button
            onClick={() => setActiveTab('perks')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
              activeTab === 'perks' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Zap size={18} /> Perks
          </button>
          <button
            onClick={() => setActiveTab('insurance')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
              activeTab === 'insurance' ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shield size={18} /> Insurance
          </button>
          <button
            onClick={() => setActiveTab('effects')}
            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
              activeTab === 'effects' ? 'bg-pink-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles size={18} /> Effects
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'coins' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {coinPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`relative p-4 rounded-lg transition-all transform hover:scale-105 ${
                    selectedPackage?.id === pkg.id
                      ? "bg-purple-600 ring-2 ring-purple-400"
                      : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-2 -right-2 bg-red-600 text-xs px-2 py-1 rounded-full font-bold">
                      POPULAR
                    </div>
                  )}
                  {pkg.bestValue && (
                    <div className="absolute -top-2 -right-2 bg-green-600 text-xs px-2 py-1 rounded-full font-bold">
                      BEST
                    </div>
                  )}
                  <div className="text-4xl mb-2">{pkg.emoji}</div>
                  <div className="text-xl font-bold mb-1 text-yellow-400">
                    {pkg.coins.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-300">coins</div>
                  <div className="text-lg font-bold mt-2 text-white">
                    {pkg.price}
                  </div>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'perks' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {perks.map((perk) => (
                <div key={perk.id} className="bg-gray-800 p-4 rounded-lg border border-purple-500/30 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl">{perk.icon || '⚡'}</div>
                    <div>
                      <div className="font-bold">{perk.name}</div>
                      <div className="text-xs text-yellow-400">{perk.cost} Coins</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mb-3 flex-1">{perk.description}</p>
                  <button
                    onClick={() => handleItemPurchase(perk, 'perk')}
                    disabled={loading}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold text-sm"
                  >
                    Buy ({perk.duration_minutes}m)
                  </button>
                </div>
              ))}
              {perks.length === 0 && <div className="col-span-2 text-center text-gray-500">No perks available</div>}
            </div>
          )}

          {activeTab === 'insurance' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {insuranceOptions.map((opt) => (
                <div key={opt.id} className="bg-gray-800 p-4 rounded-lg border border-blue-500/30 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-2xl">{opt.icon || '🛡️'}</div>
                    <div>
                      <div className="font-bold">{opt.name}</div>
                      <div className="text-xs text-yellow-400">{opt.cost} Coins</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mb-3 flex-1">{opt.description}</p>
                  <button
                    onClick={() => handleItemPurchase(opt, 'insurance')}
                    disabled={loading}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm"
                  >
                    Buy ({opt.duration_hours}h)
                  </button>
                </div>
              ))}
              {insuranceOptions.length === 0 && <div className="col-span-2 text-center text-gray-500">No insurance available</div>}
            </div>
          )}

          {activeTab === 'effects' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(ENTRANCE_EFFECTS_CONFIG).map(([id, effect]) => {
                  const isOwned = ownedEffects.has(id);
                  return (
                    <div key={id} className="bg-gray-800 p-4 rounded-lg border border-pink-500/30 flex flex-col">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-2xl">✨</div>
                        <div>
                          <div className="font-bold">{effect.name}</div>
                          <div className="text-xs text-yellow-400">{effect.cost} Coins</div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-3 flex-1">{effect.description}</p>
                      <button
                        onClick={() => !isOwned && handleItemPurchase({ ...effect, id }, 'effect')}
                        disabled={loading || isOwned}
                        className={`w-full py-2 rounded font-bold text-sm ${
                          isOwned 
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-pink-600 hover:bg-pink-500 text-white'
                        }`}
                      >
                        {isOwned ? 'Owned' : 'Buy Now'}
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
                <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                  <Shield size={16} />
                  IMPORTANT NOTICE
                </h3>
                <ul className="text-xs text-red-300 space-y-1 list-disc pl-4">
                  <li>No refunds on digital items. Sold as is.</li>
                  <li>Any chargeback or dispute will result in an <strong>INSTANT IP BAN</strong>.</li>
                  <li>Officers monitor all transactions. New accounts evading bans will be IP banned immediately.</li>
                  <li>Entrance effects are permanent purchases attached to your account.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer for Coins Tab */}
        {activeTab === 'coins' && (
          <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentMethod('stripe')}
                className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                  paymentMethod === 'stripe'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                💳 Card
              </button>
              <button
                onClick={() => setPaymentMethod('cashapp')}
                className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                  paymentMethod === 'cashapp'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Smartphone size={16} className="inline mr-1" /> Cash App
              </button>
            </div>

            {paymentMethod === 'stripe' ? (
              <button
                onClick={handleCoinPurchase}
                disabled={!selectedPackage}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-700 hover:to-red-700 disabled:opacity-50 rounded-lg font-bold transition-all"
              >
                {selectedPackage
                  ? `Purchase ${selectedPackage.coins} coins for ${selectedPackage.price}`
                  : "Select a Package"}
              </button>
            ) : (
              <button
                onClick={() => setCashAppModalOpen(true)}
                disabled={!selectedPackage}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
              >
                <Smartphone size={18} />
                {selectedPackage
                  ? `Send ${selectedPackage.coins} coins via Cash App (${selectedPackage.price})`
                  : "Select a Package"}
              </button>
            )}
            
            <p className="text-xs text-gray-400 text-center">
              {paymentMethod === 'stripe'
                ? 'Secure card payment - instant coins'
                : 'Send to $trollcity95 - coins after verification'}
            </p>
          </div>
        )}

        <CashAppPaymentModal
          isOpen={cashAppModalOpen && activeTab === 'coins'}
          onClose={() => setCashAppModalOpen(false)}
          coins={selectedPackage?.coins || 0}
          amount={parseFloat(selectedPackage?.price || '0')}
          onSuccess={(_orderId) => {
            setCashAppModalOpen(false);
            toast.success(`Payment request created! We'll verify and grant your coins shortly.`);
          }}
        />
      </div>
    </div>
  );
}
