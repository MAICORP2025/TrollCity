import { useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { useAuthStore } from '../store';
import { toast } from 'sonner';

interface HouseInfo {
  id: string;
  owner_user_id: string;
  condition: number;
  upgrade_level: number;
  neighborhood_id: string | null;
  electric_on: boolean;
  water_on: boolean;
  internet_on: boolean;
  is_reposessed: boolean;
}

interface InsuranceInfo {
  id: string;
  user_id: string;
  house_id: string;
  expires_at: string;
  status: string;
  deductible_paid: number;
}

interface RaidInfo {
  id: string;
  house_id: string;
  raided_by_user_id: string;
  damage_level: string;
  raided_at: string;
  repaired_at: string | null;
}

interface UseHouseRaidActionsResult {
  house: HouseInfo | null;
  insurance: InsuranceInfo | null;
  activeRaids: RaidInfo[];
  loading: boolean;
  raiding: boolean;
  repairing: boolean;
  fetchHouse: (userId: string) => Promise<void>;
  raidHouse: () => Promise<boolean>;
  repairHouse: () => Promise<boolean>;
  isRaided: boolean;
  hasInsurance: boolean;
  insuranceExpired: boolean;
}

const RAID_COST = 100;
const REPAIR_COST = 50;

export function useHouseRaidActions(): UseHouseRaidActionsResult {
  const { user, profile } = useAuthStore();
  const [house, setHouse] = useState<HouseInfo | null>(null);
  const [insurance, setInsurance] = useState<InsuranceInfo | null>(null);
  const [activeRaids, setActiveRaids] = useState<RaidInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [raiding, setRaiding] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const isRaided = activeRaids.length > 0;
  const insuranceExpired = insurance
    ? new Date(insurance.expires_at) <= new Date()
    : true;
  const hasInsurance = insurance != null && !insuranceExpired;

  const fetchHouse = useCallback(async (userId: string) => {
    if (!userId) return;

    setLoading(true);
    try {
      // Fetch house
      const { data: houseData } = await supabase
        .from('houses')
        .select('*')
        .eq('owner_user_id', userId)
        .maybeSingle();

      if (houseData) {
        setHouse(houseData as HouseInfo);

        // Fetch active raids
        const { data: raidsData } = await supabase
          .from('house_raids')
          .select('*')
          .eq('house_id', houseData.id)
          .is('repaired_at', null)
          .order('raided_at', { ascending: false });

        setActiveRaids(raidsData as RaidInfo[] || []);

        // Fetch insurance
        const { data: insData } = await supabase
          .from('homeowners_insurances')
          .select('*')
          .eq('house_id', houseData.id)
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setInsurance(insData as InsuranceInfo || null);
      } else {
        setHouse(null);
        setActiveRaids([]);
        setInsurance(null);
      }
    } catch (err) {
      console.error('[useHouseRaidActions] Error fetching house:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const raidHouse = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !house) {
      toast.error('Cannot raid: missing user or house');
      return false;
    }

    // Staff cannot raid
    const isStaff = profile?.is_admin || profile?.is_troll_officer || profile?.role === 'admin';
    if (isStaff) {
      toast.error('Staff cannot raid houses');
      return false;
    }

    // Check coin balance
    if ((profile?.troll_coins || 0) < RAID_COST) {
      toast.error(`Need ${RAID_COST} Troll Coins to raid`);
      return false;
    }

    setRaiding(true);
    try {
      // Use existing deduct_coins RPC
      const { error: deductError } = await supabase.rpc('deduct_coins', {
        amount: RAID_COST,
      });
      if (deductError) throw deductError;

      // Insert raid record
      const { error: raidError } = await supabase.from('house_raids').insert({
        house_id: house.id,
        raided_by_user_id: user.id,
        damage_level: 'minor',
      });
      if (raidError) throw raidError;

      // Use existing update_house_condition RPC
      const { error: conditionError } = await supabase.rpc('update_house_condition', {
        house_id: house.id,
        condition_change: -10,
      });
      if (conditionError) throw conditionError;

      toast.success('House raided! ⚔️');

      // Refresh house data
      await fetchHouse(house.owner_user_id);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Raid failed');
      return false;
    } finally {
      setRaiding(false);
    }
  }, [user?.id, house, profile, fetchHouse]);

  const repairHouse = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !house) {
      toast.error('Cannot repair: missing user or house');
      return false;
    }

    // Only owner can repair
    if (house.owner_user_id !== user.id) {
      toast.error('Only the owner can repair');
      return false;
    }

    if ((profile?.troll_coins || 0) < REPAIR_COST) {
      toast.error(`Need ${REPAIR_COST} Troll Coins to repair`);
      return false;
    }

    setRepairing(true);
    try {
      // Deduct repair cost
      const { error: deductError } = await supabase.rpc('deduct_coins', {
        amount: REPAIR_COST,
      });
      if (deductError) throw deductError;

      // Mark raids as repaired
      const { error: repairRaidsError } = await supabase
        .from('house_raids')
        .update({ repaired_at: new Date().toISOString() })
        .eq('house_id', house.id)
        .is('repaired_at', null);
      if (repairRaidsError) throw repairRaidsError;

      // Restore house condition
      const { error: conditionError } = await supabase.rpc('update_house_condition', {
        house_id: house.id,
        condition_change: 20,
      });
      if (conditionError) throw conditionError;

      toast.success('House repaired! 🔧');
      await fetchHouse(house.owner_user_id);
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Repair failed');
      return false;
    } finally {
      setRepairing(false);
    }
  }, [user?.id, house, profile, fetchHouse]);

  return {
    house,
    insurance,
    activeRaids,
    loading,
    raiding,
    repairing,
    fetchHouse,
    raidHouse,
    repairHouse,
    isRaided,
    hasInsurance,
    insuranceExpired,
  };
}
