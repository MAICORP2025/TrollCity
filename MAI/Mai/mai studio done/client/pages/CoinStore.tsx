import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Coins, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface CoinPackage {
  id: string;
  amount: number;
  price: number;
  bonus: number;
  popular?: boolean;
}

const COIN_PACKAGES: CoinPackage[] = [
  {
    id: '1',
    amount: 100,
    price: 0.99,
    bonus: 0,
  },
  {
    id: '2',
    amount: 500,
    price: 4.99,
    bonus: 50,
  },
  {
    id: '3',
    amount: 1000,
    price: 9.99,
    bonus: 150,
    popular: true,
  },
  {
    id: '4',
    amount: 5000,
    price: 49.99,
    bonus: 1000,
  },
  {
    id: '5',
    amount: 10000,
    price: 99.99,
    bonus: 2500,
  },
];

export default function CoinStore() {
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePurchase = async (packageId: string) => {
    const pkg = COIN_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return;

    setSelectedPackage(packageId);
    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      toast.success(`Purchased ${pkg.amount + pkg.bonus} MAI Coins!`);
    }, 1500);
  };

  return (
    <Layout>
      <section className="section-padding bg-gradient-to-b from-black via-slate-900/20 to-black">
        <div className="container-wide">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Coins className="text-yellow-400" size={32} />
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                MAI Coin Store
              </h1>
            </div>
            <p className="text-gray-400 text-lg mb-4">
              Stock up on MAI Coins to unlock premium content and support your favorite creators
            </p>

            {user && (
              <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-6 py-3">
                <Coins className="text-yellow-400" size={20} />
                <span className="text-white font-semibold">
                  Your Balance: <span className="text-yellow-400">{user.coin_balance}</span> Coins
                </span>
              </div>
            )}
          </div>

          {/* Coin Packages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-16">
            {COIN_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative rounded-2xl overflow-hidden transition-all ${
                  pkg.popular
                    ? 'card-glow md:col-span-2 lg:col-span-1 md:row-span-2 flex flex-col'
                    : 'card-glow'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-yellow-400 to-red-500 text-black text-center py-2 font-bold text-sm">
                    MOST POPULAR
                  </div>
                )}

                <div className={`p-6 flex flex-col flex-1 ${pkg.popular ? 'pt-16' : ''}`}>
                  {/* Coin Amount */}
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Coins className="text-yellow-400" size={28} />
                      <span className="text-3xl font-bold text-white">
                        {pkg.amount}
                      </span>
                    </div>
                    {pkg.bonus > 0 && (
                      <div className="text-sm font-semibold text-yellow-400 bg-yellow-400/10 inline-block px-3 py-1 rounded-full">
                        +{pkg.bonus} Bonus
                      </div>
                    )}
                    <p className="text-gray-400 text-xs mt-3">
                      Total: {pkg.amount + pkg.bonus} Coins
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-center mb-6">
                    <div className="text-2xl font-bold text-white mb-1">
                      ${pkg.price.toFixed(2)}
                    </div>
                    <p className="text-gray-400 text-xs">
                      ${(pkg.price / (pkg.amount + pkg.bonus) * 1000).toFixed(2)} per 1K coins
                    </p>
                  </div>

                  {/* Button */}
                  <Button
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={isProcessing && selectedPackage === pkg.id}
                    className={`w-full font-semibold h-10 mt-auto ${
                      pkg.popular ? 'neon-btn-gold text-black' : 'neon-btn-red'
                    }`}
                  >
                    {isProcessing && selectedPackage === pkg.id ? (
                      'Processing...'
                    ) : (
                      <>
                        <Zap size={16} className="mr-2" />
                        Buy Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Benefits Section */}
          <div className="bg-gradient-to-r from-yellow-950/30 to-red-950/30 border border-yellow-400/20 rounded-2xl p-8 mb-16">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">
              What Can You Do With MAI Coins?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: '🎬',
                  title: 'Unlock Premium Content',
                  desc: 'Access exclusive movies and creator-only content',
                },
                {
                  icon: '💝',
                  title: 'Support Creators',
                  desc: 'Send coins to your favorite creators to show support',
                },
                {
                  icon: '⭐',
                  title: 'Premium Features',
                  desc: 'Unlock VIP status and special platform features',
                },
              ].map((benefit, i) => (
                <div key={i} className="text-center">
                  <div className="text-4xl mb-3">{benefit.icon}</div>
                  <h3 className="text-white font-semibold mb-2">{benefit.title}</h3>
                  <p className="text-gray-400 text-sm">{benefit.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white/5 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                {
                  q: 'Are purchases refundable?',
                  a: 'Coin purchases are non-refundable once used. Unused coins can be refunded within 30 days.',
                },
                {
                  q: 'Do coins expire?',
                  a: 'No, your MAI Coins never expire. You can use them whenever you want.',
                },
                {
                  q: 'What payment methods are accepted?',
                  a: 'We accept all major credit cards, PayPal, and other payment methods.',
                },
                {
                  q: 'How do I gift coins to friends?',
                  a: 'You can gift coins through your profile settings under the "Send Coins" option.',
                },
              ].map((faq, i) => (
                <div key={i} className="border-l-2 border-yellow-400 pl-4">
                  <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                  <p className="text-gray-400 text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
