import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { Gift, ExternalLink, Copy, CheckCircle, Clock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface GiftCard {
  id: string;
  usd_value: number;
  gift_card_provider: string;
  gift_card_code: string;
  status: string;
  created_at: string;
  fulfilled_at: string;
}

export default function GiftCardsPage() {
  const { user } = useAuthStore();
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchGiftCards = async () => {
      try {
        const { data, error } = await supabase
          .from('cashout_requests')
          .select('*')
          .eq('user_id', user.id)
          .eq('delivery_method', 'App Delivery') // Only show app delivered cards
          .order('created_at', { ascending: false });

        if (error) throw error;
        setGiftCards(data || []);
      } catch (error) {
        console.error('Error fetching gift cards:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGiftCards();

    // Subscribe to updates so user sees it instantly when admin fulfills
    const subscription = supabase
      .channel('my_gift_cards')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'cashout_requests',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchGiftCards();
        toast.success('Gift card status updated!');
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Gift card code copied!');
  };

  return (
    <div className="min-h-screen bg-[#0A0814] text-white p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/wallet" className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Gift className="w-8 h-8 text-purple-500" />
            My Gift Cards
          </h1>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading your gift cards...</div>
        ) : giftCards.length === 0 ? (
          <div className="text-center py-12 bg-[#0B0B12] rounded-2xl border border-gray-800">
            <Gift className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-300 mb-2">No Gift Cards Found</h3>
            <p className="text-gray-500 mb-2">
              There are currently no gift card payouts associated with your account.
            </p>
            <p className="text-xs text-gray-500">
              Gift card cashouts are no longer supported.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {giftCards.map((card) => (
              <div 
                key={card.id}
                className={`relative overflow-hidden rounded-2xl border transition-all ${
                  card.status === 'fulfilled' 
                    ? 'bg-gradient-to-br from-purple-900/40 to-black border-purple-500/50 shadow-[0_0_20px_rgba(147,51,234,0.2)]' 
                    : 'bg-[#0B0B12] border-gray-800 opacity-80'
                }`}
              >
                {/* Status Badge */}
                <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  card.status === 'fulfilled' ? 'bg-green-500/20 text-green-300' :
                  card.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                  card.status === 'processing' ? 'bg-blue-500/20 text-blue-300' :
                  'bg-gray-500/20 text-gray-300'
                }`}>
                  {card.status}
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-8 bg-blue-900 rounded flex items-center justify-center font-bold italic text-white text-sm">
                      VISA
                    </div>
                    <div>
                      <div className="font-bold text-lg">${card.usd_value.toFixed(2)}</div>
                      <div className="text-xs text-gray-400">Visa Gift Card</div>
                    </div>
                  </div>

                  {card.status === 'fulfilled' && card.gift_card_code ? (
                    <div className="space-y-4">
                      <div className="bg-black/60 p-4 rounded-xl border border-purple-500/30">
                        <div className="text-xs text-gray-400 mb-1">Your Gift Card Code/Link</div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 font-mono text-purple-300 break-all text-sm">
                            {card.gift_card_code}
                          </code>
                          <button 
                            onClick={() => copyCode(card.gift_card_code)}
                            className="p-2 hover:bg-purple-500/20 rounded-lg text-purple-400"
                            title="Copy"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {card.gift_card_code.startsWith('http') && (
                            <a 
                              href={card.gift_card_code} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-purple-500/20 rounded-lg text-purple-400"
                              title="Open Link"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-xs text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Ready to use
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-yellow-900/10 p-4 rounded-xl border border-yellow-500/20">
                        <div className="text-yellow-200 text-sm flex items-start gap-2">
                          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <div className="font-bold mb-1">Processing</div>
                            <p className="opacity-80 text-xs">
                              Your card is being prepared. It usually takes under 30 minutes.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t border-gray-800 flex justify-between text-xs text-gray-500">
                    <span>Requested {new Date(card.created_at).toLocaleDateString()}</span>
                    {card.fulfilled_at && (
                      <span>Delivered {new Date(card.fulfilled_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
