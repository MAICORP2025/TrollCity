import React, { useEffect, useState } from 'react';
import { X, Coins, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useGiftSystem, GiftItem } from '../../lib/hooks/useGiftSystem';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';

interface GiftTrayProps {
  recipientId: string;
  streamId: string;
  onClose: () => void;
  battleId?: string | null;
  allRecipients?: string[];
}

export default function GiftTray({ recipientId, streamId, onClose, battleId, allRecipients }: GiftTrayProps) {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const { sendGift, isSending } = useGiftSystem(recipientId, streamId, battleId, recipientId);
  const { profile } = useAuthStore();
  const [sendingToAll, setSendingToAll] = useState(false);

  useEffect(() => {
    const fetchGifts = async () => {
      try {
          // TRAE: Updated to use centralized purchasable_items table
          const { data, error } = await supabase
            .from('purchasable_items')
            .select('*')
            .eq('category', 'gift')
            .eq('is_active', true)
            .order('coin_price', { ascending: true });

          if (error) {
            console.error('Error fetching gifts:', error);
          } else {
            // Map DB gifts to GiftItem interface
            const mappedGifts: GiftItem[] = data.map((g: any) => ({
              id: g.id,
              name: g.display_name,
              icon: g.metadata?.icon || '🎁', // Use metadata icon or fallback
              coinCost: g.coin_price || 0,
              type: 'paid',
              slug: g.item_key,
              category: g.category,
              subcategory: g.metadata?.subcategory || 'Misc'
            }));
            setGifts(mappedGifts);
            
            // Set default category if available
            if (mappedGifts.length > 0) {
                 const firstCat = mappedGifts[0].subcategory;
                 if (firstCat && firstCat !== 'Misc') {
                     setActiveCategory('All');
                 }
            }
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
    };

    fetchGifts();
  }, []);

  const categories = React.useMemo(() => {
      const cats = Array.from(new Set(gifts.map(g => g.subcategory).filter(Boolean) as string[]));
      // Custom sort order based on user request if possible, otherwise alphabetical
      const order = [
          'Court & Government',
          'Podcast & Media', 
          'Homes & Real Estate',
          'Vehicles & Transport',
          'Money & Flex',
          'Battle & Chaos',
          'Luxury / Rare'
      ];
      
      return ['All', ...cats.sort((a, b) => {
          const indexA = order.indexOf(a);
          const indexB = order.indexOf(b);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return a.localeCompare(b);
      })];
  }, [gifts]);

  const filteredGifts = React.useMemo(() => {
      if (activeCategory === 'All') return gifts;
      return gifts.filter(g => g.subcategory === activeCategory);
  }, [gifts, activeCategory]);

  const handleSend = async (gift: GiftItem) => {
    if (allRecipients && allRecipients.length > 0) {
        setSendingToAll(true);
        try {
            // Send to each recipient
            // We do this sequentially to avoid overwhelming the client/server, but parallel could be faster.
            // Parallel with Promise.all is better for UX.
            const promises = allRecipients.map(recipientId => 
                sendGift(gift, recipientId).catch(e => console.error(`Failed to send to ${recipientId}`, e))
            );
            
            await Promise.all(promises);
            toast.success(`Gift sent to ${allRecipients.length} users!`);
            
        } catch (e) {
            console.error(e);
            toast.error("Failed to send some gifts");
        }
        setSendingToAll(false);
        onClose();
        return;
    }

    const success = await sendGift(gift);
    if (success) {
      // Optional: Close tray or keep open for combo
      // onClose(); 
    }
  };

  return (
    <div className="absolute bottom-0 left-0 w-full bg-zinc-900/95 backdrop-blur-xl border-t border-white/10 p-4 rounded-t-3xl shadow-2xl z-50 animate-in slide-in-from-bottom-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Coins className="text-yellow-400" size={20} />
            {allRecipients ? "Gift Everyone" : "Send Gift"}
        </h3>
        <div className="flex items-center gap-4">
            <div className="text-yellow-400 font-mono text-sm bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                {profile?.troll_coins?.toLocaleString() || 0} Coins
            </div>
            <button 
                onClick={onClose}
                className="p-1 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            >
                <X size={24} />
            </button>
        </div>
      </div>

      {/* Category Tabs */}
      {!loading && gifts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 custom-scrollbar">
            {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        activeCategory === cat 
                        ? 'bg-yellow-400 text-black' 
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    {cat}
                </button>
            ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-white" />
        </div>
      ) : filteredGifts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
            No gifts available in this category.
        </div>
      ) : (
        <div className="grid grid-cols-4 md:grid-cols-5 gap-3 overflow-y-auto max-h-60 custom-scrollbar p-1">
            {filteredGifts.map((gift) => {
                const isHighValue = gift.coinCost >= 1000;
                const isLegendary = gift.coinCost >= 5000;
                
                return (
                <button
                    key={gift.id}
                    disabled={isSending}
                    onClick={() => handleSend(gift)}
                    className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all group relative border ${
                        isHighValue 
                        ? 'border-yellow-400/30 bg-yellow-400/5 shadow-[0_0_10px_rgba(250,204,21,0.1)]' 
                        : 'border-transparent hover:border-white/10 hover:bg-white/10'
                    }`}
                >
                    <div className={`text-3xl transform group-hover:scale-110 transition-transform duration-200 ${isLegendary ? 'animate-pulse' : ''}`}>
                        {gift.icon || '🎁'}
                    </div>
                    <div className="text-center w-full">
                        <div className={`text-xs font-medium truncate w-full ${isHighValue ? 'text-yellow-200' : 'text-gray-300'}`}>
                            {gift.name}
                        </div>
                        <div className="text-[10px] text-yellow-400 font-mono flex items-center justify-center gap-1 mt-0.5">
                           {gift.coinCost > 0 ? (
                             <>
                               <Coins size={10} />
                               {gift.coinCost.toLocaleString()}
                             </>
                           ) : (
                             <span className="text-green-400">FREE</span>
                           )}
                        </div>
                    </div>
                    
                    {/* Hover Effect Glow */}
                    <div className="absolute inset-0 bg-yellow-400/5 opacity-0 group-hover:opacity-100 rounded-xl transition-opacity pointer-events-none" />
                </button>
            )})}
        </div>
      )}
    </div>
  );
}
