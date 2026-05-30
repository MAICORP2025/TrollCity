import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  Package, 
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  User
} from 'lucide-react';
import { toast } from 'sonner';

interface UserPurchase {
  id: string;
  user_id: string;
  item_id: string;
  username: string;
  display_name?: string;
  item_key: string;
  item_display_name: string;
  coin_price: number | null;
  usd_price: number | null;
  is_coin_pack: boolean;
  frontend_source: string;
  created_at: string;
}

interface UserItemGroup {
  user_id: string;
  username: string;
  display_name?: string;
  purchases: UserPurchase[];
  total_coins_spent: number;
  total_usd_spent: number;
}

export default function LivePurchasableInventory() {
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch user_inventory with item_id references
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('user_inventory')
        .select(`
          id,
          user_id,
          item_id,
          acquired_at
        `)
        .order('acquired_at', { ascending: false })
        .limit(5000);

      if (inventoryError) throw inventoryError;

      // Get unique item IDs
      const itemIds = [...new Set((inventoryData || []).map((inv: any) => inv.item_id).filter(Boolean))] as string[];
      const itemMap = new Map<string, any>();

      // Fetch purchasable items separately to avoid schema cache issues
      if (itemIds.length > 0) {
        const { data: itemsData, error: itemsError } = await supabase
          .from('purchasable_items')
          .select('id, item_key, display_name, coin_price, usd_price, is_coin_pack, frontend_source')
          .in('id', itemIds);

        if (itemsError) throw itemsError;
        (itemsData || []).forEach((item: any) => {
          itemMap.set(item.id, item);
        });
      }

      // Get unique user IDs
      const userIds = [...new Set((inventoryData || []).map((inv: any) => inv.user_id).filter(Boolean))] as string[];
      const userMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_profiles')
          .select('id, username, display_name')
          .in('id', userIds);

        (usersData || []).forEach((u: any) => {
          userMap.set(u.id, u.display_name || u.username || u.id);
        });
      }

      // Merge data
      const formattedPurchases = (inventoryData || []).map((inv: any) => {
        const item = itemMap.get(inv.item_id) || {};
        return {
          id: inv.id,
          user_id: inv.user_id,
          item_id: inv.item_id,
          username: userMap.get(inv.user_id) || inv.user_id,
          display_name: userMap.get(inv.user_id) || inv.user_id,
          item_key: item.item_key,
          item_display_name: item.display_name,
          coin_price: item.coin_price,
          usd_price: item.usd_price,
          is_coin_pack: item.is_coin_pack,
          frontend_source: item.frontend_source,
          created_at: inv.acquired_at,
        };
      });

      setPurchases(formattedPurchases);
    } catch (err: any) {
      console.error('Error fetching purchasable inventory:', err);
      toast.error('Failed to load purchasable inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const refreshTimer = window.setInterval(fetchData, 60000);
    return () => window.clearInterval(refreshTimer);
  }, [fetchData]);

  const userGroups = useMemo((): UserItemGroup[] => {
    const groups = new Map<string, UserItemGroup>();

    purchases.forEach(p => {
      if (!groups.has(p.user_id)) {
        groups.set(p.user_id, {
          user_id: p.user_id,
          username: p.username,
          display_name: p.display_name,
          purchases: [],
          total_coins_spent: 0,
          total_usd_spent: 0,
        });
      }

      const group = groups.get(p.user_id)!;
      group.purchases.push(p);
      group.total_coins_spent += Number(p.coin_price) || 0;
      group.total_usd_spent += Number(p.usd_price) || 0;
    });

    return Array.from(groups.values()).sort((a, b) => b.total_usd_spent - a.total_usd_spent || b.total_coins_spent - a.total_coins_spent);
  }, [purchases]);

  const toggleUserExpanded = useCallback((userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div 
          className="p-4 border-b border-zinc-800 flex items-center justify-between cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => setIsInventoryExpanded(!isInventoryExpanded)}
        >
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">Live Purchasable Inventory</h3>
            {isInventoryExpanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </div>

          <div 
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-zinc-400">
              {userGroups.length} users with purchases
            </span>
          </div>
        </div>

        {isInventoryExpanded && (
          <div className="max-h-[600px] overflow-y-auto">
            {userGroups.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                No purchases found yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {userGroups.map((group) => {
                  const isUserExpanded = expandedUsers.has(group.user_id);
                  return (
                    <div key={group.user_id} className="bg-zinc-900/30">
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
                        onClick={() => toggleUserExpanded(group.user_id)}
                      >
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-purple-300" />
                          <div>
                            <div className="font-semibold text-white">{group.display_name || group.username}</div>
                            <div className="text-xs text-zinc-500">{group.purchases.length} items purchased</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="text-yellow-400 font-mono">
                            {group.total_coins_spent.toLocaleString()} 🪙
                          </div>
                          <div className="text-green-400 font-mono">
                            ${group.total_usd_spent.toLocaleString()}
                          </div>
                          {isUserExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>
                      </div>

                      {isUserExpanded && (
                        <div className="bg-zinc-950/50 px-4 pb-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="text-xs text-zinc-500 uppercase">
                                <tr>
                                  <th className="px-3 py-2 text-left">Item</th>
                                  <th className="px-3 py-2 text-left">Price</th>
                                  <th className="px-3 py-2 text-left">Source</th>
                                  <th className="px-3 py-2 text-left">Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-800">
                                {group.purchases.map((purchase) => (
                                  <tr key={purchase.id} className="hover:bg-zinc-800/30">
                                    <td className="px-3 py-2 text-white">
                                      {purchase.item_display_name}
                                      <div className="text-xs text-zinc-500 font-mono">{purchase.item_key}</div>
                                    </td>
                                    <td className="px-3 py-2">
                                      {purchase.usd_price ? (
                                        <span className="text-green-400 font-mono">${purchase.usd_price}</span>
                                      ) : (
                                        <span className="text-yellow-400 font-mono">{purchase.coin_price?.toLocaleString()} 🪙</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-zinc-400">
                                      {purchase.frontend_source}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-zinc-500">
                                      {purchase.created_at ? new Date(purchase.created_at).toLocaleDateString() : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}