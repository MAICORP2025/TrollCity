import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Heart, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

interface MessagePricing {
  id: string;
  creator_id: string;
  coin_cost_per_message: number;
  free_daily_messages: number;
  vip_fans_message_free: boolean;
  fam_members_discount_percent: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface CreatorProfile {
  id: string;
  user_id: string;
  creator_name: string;
  bio: string;
  category: string;
  messaging_paid_enabled: boolean;
  created_at: string;
}

export default function CreatorMessagePricing() {
  const { user } = useAuth();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [pricing, setPricing] = useState<MessagePricing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    coin_cost_per_message: 50,
    free_daily_messages: 0,
    vip_fans_message_free: false,
    fam_members_discount_percent: 0,
    enabled: true,
  });

  useEffect(() => {
    if (user) {
      fetchCreatorData();
    }
  }, [user]);

  const fetchCreatorData = async () => {
    setIsLoading(true);
    try {
      const creatorResponse = await fetch(`/api/creator/${user?.id}`);
      if (!creatorResponse.ok) {
        throw new Error('Not an approved creator');
      }

      const creatorData = await creatorResponse.json();
      setCreator(creatorData);

      const pricingResponse = await fetch(`/api/messages/pricing/${creatorData.id}`);
      if (pricingResponse.ok) {
        const pricingData = await pricingResponse.json();
        if (pricingData.pricing) {
          setPricing(pricingData.pricing);
          setFormData({
            coin_cost_per_message: pricingData.pricing.coin_cost_per_message,
            free_daily_messages: pricingData.pricing.free_daily_messages,
            vip_fans_message_free: pricingData.pricing.vip_fans_message_free,
            fam_members_discount_percent: pricingData.pricing.fam_members_discount_percent,
            enabled: pricingData.pricing.enabled,
          });
        }
      }
    } catch (error) {
      toast.error('Failed to load creator data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePricing = async () => {
    if (!creator) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/messages/pricing/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: creator.id,
          ...formData,
        }),
      });

      if (!response.ok) throw new Error('Failed to save pricing');

      const data = await response.json();
      setPricing(data.pricing);
      toast.success('Message pricing updated successfully!');
    } catch (error) {
      toast.error('Failed to save pricing');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!creator) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 px-4">
          <div className="container-wide max-w-2xl">
            <div className="card-glow rounded-lg p-8 border border-red-500/20">
              <div className="flex gap-4">
                <AlertCircle className="text-red-400 flex-shrink-0" size={24} />
                <div>
                  <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
                  <p className="text-gray-400">You must be an approved creator to configure message pricing.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4 pb-20">
        <div className="container-wide max-w-2xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Heart className="text-yellow-400" size={32} />
              <h1 className="text-4xl font-black text-gradient-gold-red">
                Paid Messages
              </h1>
            </div>
            <p className="text-gray-400">
              Set pricing for fans to send you paid messages
            </p>
          </div>

          {/* Creator Info */}
          <div className="card-glow rounded-lg p-6 border border-white/10 mb-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-gray-400 text-sm mb-1">Creator</p>
                <p className="text-white font-semibold text-lg">{creator.creator_name}</p>
              </div>
              <div className={`px-4 py-2 rounded-lg font-semibold ${
                creator.messaging_paid_enabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {creator.messaging_paid_enabled ? '✓ Paid Messaging Enabled' : 'Paid Messaging Disabled'}
              </div>
            </div>
          </div>

          {/* Pricing Settings */}
          <div className="card-glow rounded-lg p-6 border border-white/10 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Message Pricing Settings</h2>

            <div className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <p className="font-semibold text-white mb-1">Enable Paid Messages</p>
                  <p className="text-sm text-gray-400">Allow fans to send you paid messages</p>
                </div>
                <div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) =>
                        setFormData({ ...formData, enabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                  </label>
                </div>
              </div>

              {/* Cost Per Message */}
              <div>
                <Label className="text-white mb-2">Cost Per Message (coins)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.coin_cost_per_message}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      coin_cost_per_message: parseInt(e.target.value) || 0,
                    })
                  }
                  className="bg-white/10 border border-white/20 text-white"
                  placeholder="50"
                />
                <p className="text-xs text-gray-400 mt-2">
                  How many coins fans need to send you a message
                </p>
              </div>

              {/* Free Daily Messages */}
              <div>
                <Label className="text-white mb-2">Free Daily Messages</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.free_daily_messages}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      free_daily_messages: parseInt(e.target.value) || 0,
                    })
                  }
                  className="bg-white/10 border border-white/20 text-white"
                  placeholder="0"
                />
                <p className="text-xs text-gray-400 mt-2">
                  Number of free messages fans can send you per day (0 = all messages are paid)
                </p>
              </div>

              {/* VIP Free Messages */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                <div>
                  <p className="font-semibold text-white mb-1">VIP Fans Message Free</p>
                  <p className="text-sm text-gray-400">Allow VIP/premium fans to message you for free</p>
                </div>
                <div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.vip_fans_message_free}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vip_fans_message_free: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-400"></div>
                  </label>
                </div>
              </div>

              {/* Fam Members Discount */}
              <div>
                <Label className="text-white mb-2">Fam Members Discount (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.fam_members_discount_percent}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fam_members_discount_percent: parseInt(e.target.value) || 0,
                    })
                  }
                  className="bg-white/10 border border-white/20 text-white"
                  placeholder="0"
                />
                <p className="text-xs text-gray-400 mt-2">
                  Discount percentage for your fam (fan club) members (0-100%)
                </p>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-8">
              <Button
                onClick={handleSavePricing}
                disabled={isSaving}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold h-11"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">How Paid Messages Work</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Set a coin cost for fans to send you messages</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Offer free daily messages to your fans</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Give VIP fans and fam members discounts or free access</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Coins from message payments go directly to your balance</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
