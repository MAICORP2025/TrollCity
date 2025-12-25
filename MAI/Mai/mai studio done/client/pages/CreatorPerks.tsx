import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2, Plus, Trash2, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreatorPerk {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  coin_cost: number;
  active: boolean;
  perk_type: string;
  perk_limit: number | null;
  created_at: string;
}

interface CreatorProfile {
  id: string;
  user_id: string;
  creator_name: string;
  bio: string;
  category: string;
  perks_enabled: boolean;
  created_at: string;
}

const PERK_TYPES = [
  { value: 'exclusive_content', label: 'Exclusive Content' },
  { value: 'early_access', label: 'Early Access' },
  { value: 'personalized_message', label: 'Personalized Message' },
  { value: 'discord_role', label: 'Discord Role' },
  { value: 'custom_shoutout', label: 'Custom Shoutout' },
  { value: 'one_on_one_chat', label: '1-on-1 Chat' },
  { value: 'custom', label: 'Custom' },
];

export default function CreatorPerks() {
  const { user } = useAuth();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [perks, setPerks] = useState<CreatorPerk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    coin_cost: '',
    perk_type: 'custom',
    perk_limit: '',
  });

  useEffect(() => {
    if (user) {
      fetchCreatorData();
    }
  }, [user]);

  const fetchCreatorData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const creatorResponse = await fetch(`/api/creator/${user.id}`);
      if (!creatorResponse.ok) {
        throw new Error('Not an approved creator');
      }

      const creatorData = await creatorResponse.json();
      setCreator(creatorData);

      const perksResponse = await fetch(`/api/creator/${creatorData.id}/perks`);
      if (perksResponse.ok) {
        const perksData = await perksResponse.json();
        setPerks(perksData || []);
      }
    } catch (error) {
      toast.error('Failed to load creator data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPerk = async () => {
    if (!formData.title || !formData.coin_cost) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/creator/perks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: creator?.id,
          title: formData.title,
          description: formData.description,
          coin_cost: parseInt(formData.coin_cost),
          perk_type: formData.perk_type,
          perk_limit: formData.perk_limit ? parseInt(formData.perk_limit) : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create perk');

      const newPerk = await response.json();
      setPerks([...perks, newPerk]);
      resetForm();
      toast.success('Perk created successfully!');
    } catch (error) {
      toast.error('Failed to create perk');
    }
  };

  const handleDeletePerk = async (perkId: string) => {
    if (!window.confirm('Are you sure you want to delete this perk?')) return;

    try {
      const response = await fetch(`/api/creator/perks/${perkId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete perk');

      setPerks(perks.filter((p) => p.id !== perkId));
      toast.success('Perk deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete perk');
    }
  };

  const handleTogglePerk = async (perkId: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/creator/perks/${perkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: !currentActive,
        }),
      });

      if (!response.ok) throw new Error('Failed to toggle perk');

      setPerks(
        perks.map((p) =>
          p.id === perkId ? { ...p, active: !currentActive } : p
        )
      );

      toast.success(
        !currentActive ? 'Perk enabled' : 'Perk disabled'
      );
    } catch (error) {
      toast.error('Failed to toggle perk');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      coin_cost: '',
      perk_type: 'custom',
      perk_limit: '',
    });
    setIsAdding(false);
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white">Loading perks...</p>
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
                  <p className="text-gray-400">You must be an approved creator to manage perks.</p>
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
        <div className="container-wide max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="text-yellow-400" size={32} />
              <h1 className="text-4xl font-black text-gradient-gold-red">
                Creator Perks
              </h1>
            </div>
            <p className="text-gray-400">
              Create and manage exclusive perks for your fans
            </p>
          </div>

          {/* Creator Info */}
          <div className="card-glow rounded-lg p-6 border border-white/10 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Creator</p>
                <p className="text-white font-semibold text-lg">{creator.creator_name}</p>
              </div>
              <div className={`px-4 py-2 rounded-lg font-semibold ${
                creator.perks_enabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {creator.perks_enabled ? '✓ Perks Enabled' : 'Perks Disabled'}
              </div>
            </div>
          </div>

          {/* Add Perk Form */}
          {!isAdding ? (
            <div className="mb-8">
              <Button
                onClick={() => setIsAdding(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold flex items-center gap-2"
              >
                <Plus size={18} />
                Create New Perk
              </Button>
            </div>
          ) : (
            <div className="card-glow rounded-lg p-6 border border-yellow-400/30 mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Create New Perk</h3>
              <div className="space-y-4 mb-4">
                <div>
                  <Label className="text-white mb-2">Title *</Label>
                  <Input
                    placeholder="e.g., Exclusive Behind-the-Scenes Video"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="bg-white/10 border border-white/20 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white mb-2">Description</Label>
                  <Textarea
                    placeholder="Describe what your fans will get with this perk"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="bg-white/10 border border-white/20 text-white resize-none"
                    rows={3}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-white mb-2">Coin Cost *</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 500"
                      value={formData.coin_cost}
                      onChange={(e) =>
                        setFormData({ ...formData, coin_cost: e.target.value })
                      }
                      className="bg-white/10 border border-white/20 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-white mb-2">Perk Type</Label>
                    <Select value={formData.perk_type} onValueChange={(value) =>
                      setFormData({ ...formData, perk_type: value })
                    }>
                      <SelectTrigger className="bg-white/10 border border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERK_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-white mb-2">Limit (Optional)</Label>
                  <Input
                    type="number"
                    placeholder="Max number available (leave empty for unlimited)"
                    value={formData.perk_limit}
                    onChange={(e) =>
                      setFormData({ ...formData, perk_limit: e.target.value })
                    }
                    className="bg-white/10 border border-white/20 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddPerk}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold"
                >
                  Create Perk
                </Button>
                <Button
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Perks List */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Your Perks ({perks.length})</h2>

            {perks.length > 0 ? (
              <div className="space-y-4">
                {perks.map((perk) => (
                  <div
                    key={perk.id}
                    className="card-glow rounded-lg p-6 border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-white">{perk.title}</h3>
                          {perk.active && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded">
                              Active
                            </span>
                          )}
                        </div>
                        {perk.description && (
                          <p className="text-gray-400 text-sm mb-3">{perk.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-gray-400">Cost:</span>
                            <span className="text-yellow-400 font-semibold ml-2">
                              {perk.coin_cost} coins
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Type:</span>
                            <span className="text-white font-semibold ml-2 capitalize">
                              {perk.perk_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {perk.perk_limit && (
                            <div>
                              <span className="text-gray-400">Limit:</span>
                              <span className="text-white font-semibold ml-2">
                                {perk.perk_limit}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleTogglePerk(perk.id, perk.active)}
                          className={`px-3 py-2 rounded-lg font-semibold text-sm transition ${
                            perk.active
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                          }`}
                        >
                          {perk.active ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          onClick={() => handleDeletePerk(perk.id)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white/5 rounded-lg border border-white/10">
                <Sparkles className="mx-auto mb-3 text-gray-400" size={32} />
                <p className="text-gray-400 mb-4">No perks created yet</p>
                <Button
                  onClick={() => setIsAdding(true)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                >
                  Create Your First Perk
                </Button>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="mt-8 bg-white/5 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Tips for Creating Great Perks</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Price perks based on the value they provide to your fans</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Create multiple tiers at different price points</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Be clear about what fans receive with each perk</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Regularly update and refresh your perk offerings</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
