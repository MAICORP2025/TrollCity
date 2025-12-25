import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Loader2, Plus, Trash2, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PayoutGoal {
  id: string;
  coin_goal: number;
  payout_amount: number;
  enabled: boolean;
  last_payout_date: string | null;
  created_at: string;
}

export default function CreatorEarnings() {
  const { user } = useAuth();
  const [payoutGoals, setPayoutGoals] = useState<PayoutGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    coin_goal: '',
    payout_amount: '',
  });

  useEffect(() => {
    fetchPayoutGoals();
  }, [user]);

  const fetchPayoutGoals = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/payouts/goals');
      if (response.ok) {
        const data = await response.json();
        const userGoals = data.filter((goal: PayoutGoal) => {
          return true;
        });
        setPayoutGoals(data || []);
      }
    } catch (error) {
      console.error('Error fetching payout goals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPayoutGoal = async () => {
    if (!formData.coin_goal || !formData.payout_amount) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/admin/payouts/set-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          coin_goal: parseInt(formData.coin_goal),
          payout_amount: parseInt(formData.payout_amount),
        }),
      });

      if (!response.ok) throw new Error('Failed to create payout goal');

      const newGoal = await response.json();
      setPayoutGoals([...payoutGoals, newGoal]);
      setFormData({ coin_goal: '', payout_amount: '' });
      setIsAdding(false);
      toast.success('Payout goal created successfully!');
    } catch (error) {
      toast.error('Failed to create payout goal');
    }
  };

  const handleDeletePayoutGoal = async (goalId: string) => {
    if (!window.confirm('Are you sure you want to delete this payout goal?')) return;

    try {
      const response = await fetch(`/api/admin/payouts/${user?.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete payout goal');

      setPayoutGoals(payoutGoals.filter((g) => g.id !== goalId));
      toast.success('Payout goal deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete payout goal');
    }
  };

  const handleTogglePayoutGoal = async (goalId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch('/api/admin/payouts/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payout_goal_id: goalId,
          enabled: !currentEnabled,
        }),
      });

      if (!response.ok) throw new Error('Failed to toggle payout goal');

      setPayoutGoals(
        payoutGoals.map((g) =>
          g.id === goalId ? { ...g, enabled: !currentEnabled } : g
        )
      );

      toast.success(
        !currentEnabled ? 'Payout goal enabled' : 'Payout goal disabled'
      );
    } catch (error) {
      toast.error('Failed to toggle payout goal');
    }
  };

  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4 pb-20">
        <div className="container-wide max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="text-yellow-400" size={32} />
              <h1 className="text-4xl font-black text-gradient-gold-red">
                Creator Earnings
              </h1>
            </div>
            <p className="text-gray-400">
              Manage your payout tiers and earnings goals
            </p>
          </div>

          {/* Earnings Summary */}
          <div className="card-glow rounded-lg p-6 border border-white/10 mb-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-gray-400 text-sm mb-1">Current Balance</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-yellow-400">
                    {user?.coin_balance.toLocaleString()}
                  </span>
                  <span className="text-gray-400">coins</span>
                </div>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Earned (All Time)</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-green-400">
                    ${(user?.coin_balance || 0) * 0.001}
                  </span>
                  <span className="text-gray-400">USD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payout Tiers */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Payout Tiers</h2>
              {!isAdding && (
                <Button
                  onClick={() => setIsAdding(true)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add Tier
                </Button>
              )}
            </div>

            {isAdding && (
              <div className="card-glow rounded-lg p-6 border border-yellow-400/30 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Create New Payout Tier
                </h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-white mb-2">Coin Goal</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 1000"
                      value={formData.coin_goal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          coin_goal: e.target.value,
                        })
                      }
                      className="bg-white/10 border border-white/20 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Coins needed to trigger payout
                    </p>
                  </div>
                  <div>
                    <Label className="text-white mb-2">Payout Amount ($)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 10.00"
                      step="0.01"
                      value={formData.payout_amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payout_amount: e.target.value,
                        })
                      }
                      className="bg-white/10 border border-white/20 text-white"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Amount to be paid when goal is reached
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddPayoutGoal}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold"
                  >
                    Create Tier
                  </Button>
                  <Button
                    onClick={() => {
                      setIsAdding(false);
                      setFormData({ coin_goal: '', payout_amount: '' });
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-yellow-400" size={32} />
              </div>
            ) : payoutGoals.length > 0 ? (
              <div className="space-y-3">
                {payoutGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className="card-glow rounded-lg p-4 border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-yellow-400">
                            {goal.coin_goal.toLocaleString()}
                          </span>
                          <span className="text-gray-400 text-sm">coins</span>
                        </div>
                        <span className="text-gray-500">→</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-green-400">
                            ${goal.payout_amount.toFixed(2)}
                          </span>
                          <span className="text-gray-400 text-sm">USD</span>
                        </div>
                      </div>
                      {goal.last_payout_date && (
                        <p className="text-xs text-gray-500">
                          Last payout: {new Date(goal.last_payout_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleTogglePayoutGoal(goal.id, goal.enabled)}
                        className={`px-3 py-2 rounded-lg font-semibold text-sm transition ${
                          goal.enabled
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                        }`}
                      >
                        {goal.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button
                        onClick={() => handleDeletePayoutGoal(goal.id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white/5 rounded-lg border border-white/10">
                <AlertCircle className="mx-auto mb-3 text-gray-400" size={32} />
                <p className="text-gray-400 mb-4">No payout tiers yet</p>
                <Button
                  onClick={() => setIsAdding(true)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                >
                  Create Your First Tier
                </Button>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">How Payout Tiers Work</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Set a coin goal - when your balance reaches this amount, a payout is triggered</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Specify the payout amount - this is what you'll receive in USD</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Create multiple tiers - you can set up different payout levels</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Enable/disable tiers - toggle tiers on or off as needed</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
