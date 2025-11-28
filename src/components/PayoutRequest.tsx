import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";

interface PayoutTier {
  coins: number;
  cash: number;
  label: string;
}

const PAYOUT_TIERS: PayoutTier[] = [
  { coins: 10000, cash: 20.00, label: "10,000 Coins → $20.00" },
  { coins: 18000, cash: 45.00, label: "18,000 Coins → $45.00" },
  { coins: 32000, cash: 85.00, label: "32,000 Coins → $85.00" },
  { coins: 55000, cash: 150.00, label: "55,000 Coins → $150.00" },
];

const PayoutRequest: React.FC = () => {
  const { profile } = useAuthStore();
  const [selectedTier, setSelectedTier] = useState<PayoutTier | null>(null);
  const [loading, setLoading] = useState(false);

  const requestPayout = async () => {
    if (!selectedTier || !profile) return;

    if (!profile.payout_method || !profile.payout_details) {
      toast.error("Please set your payout information in your Profile Settings before requesting payout.");
      return;
    }

    if ((profile.total_earned_coins || 0) < selectedTier.coins) {
      toast.error(`You need at least ${selectedTier.coins} earned coins to request this payout`);
      return;
    }

    setLoading(true);
    try {
      await supabase.from('payout_requests').insert([
        {
          user_id: profile.id,
          coins_redeemed: selectedTier.coins,
          cash_value: selectedTier.cash,
          status: 'pending'
        }
      ]);

      toast.success("Payout request submitted! We'll review shortly.");
      setSelectedTier(null);
    } catch (error) {
      console.error('Payout request error:', error);
      toast.error("Failed to submit payout request");
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return <div>Please sign in to request payouts</div>;
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-3">Request Payout</h3>
      <p className="text-sm text-gray-400 mb-4">
        Your earned coins: {profile.total_earned_coins || 0}
      </p>

      <div className="space-y-2 mb-4">
        {PAYOUT_TIERS.map((tier) => (
          <button
            key={tier.coins}
            onClick={() => setSelectedTier(tier)}
            className={`w-full p-3 rounded border text-left ${
              selectedTier?.coins === tier.coins
                ? 'border-blue-500 bg-blue-500/20'
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <div className="font-semibold">{tier.label}</div>
            <div className="text-sm text-gray-400">
              Requires {tier.coins} earned coins
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={requestPayout}
        disabled={!selectedTier || loading}
        className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 py-2 px-4 rounded font-semibold"
      >
        {loading ? 'Submitting...' : 'Request Payout'}
      </button>
    </div>
  );
};

export default PayoutRequest;