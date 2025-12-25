import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Users, Loader2, Plus, Trash2, Edit2, AlertCircle, Coins } from 'lucide-react';
import { toast } from 'sonner';

interface CreatorFam {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  coin_cost_monthly: number;
  max_members: number | null;
  current_members: number;
  perks_included: Record<string, any>;
  active: boolean;
  created_at: string;
}

interface CreatorProfile {
  id: string;
  user_id: string;
  creator_name: string;
  bio: string;
  category: string;
  fams_enabled: boolean;
  created_at: string;
}

export default function CreatorFams() {
  const { user } = useAuth();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [fams, setFams] = useState<CreatorFam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    coin_cost_monthly: '',
    max_members: '',
    perks_included: JSON.stringify(
      {
        exclusive_content: true,
        early_access: true,
        discord_role: false,
      },
      null,
      2
    ),
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

      const famsResponse = await fetch(`/api/creator/${creatorData.id}/fams`);
      if (famsResponse.ok) {
        const famsData = await famsResponse.json();
        setFams(famsData.fams || []);
      }
    } catch (error) {
      toast.error('Failed to load creator data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFam = async () => {
    if (!formData.name || !formData.coin_cost_monthly) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/fams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: creator?.id,
          name: formData.name,
          description: formData.description,
          coin_cost_monthly: parseInt(formData.coin_cost_monthly),
          max_members: formData.max_members ? parseInt(formData.max_members) : null,
          perks_included: JSON.parse(formData.perks_included),
        }),
      });

      if (!response.ok) throw new Error('Failed to create fam');

      const newFam = await response.json();
      setFams([...fams, newFam.fam]);
      resetForm();
      toast.success('Fam created successfully!');
    } catch (error) {
      toast.error('Failed to create fam');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFam = async (famId: string) => {
    if (!window.confirm('Are you sure you want to delete this fam?')) return;

    try {
      const response = await fetch(`/api/fams/${famId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete fam');

      setFams(fams.filter((f) => f.id !== famId));
      toast.success('Fam deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete fam');
    }
  };

  const handleToggleFam = async (fam: CreatorFam) => {
    try {
      const response = await fetch(`/api/fams/${fam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fam,
          active: !fam.active,
        }),
      });

      if (!response.ok) throw new Error('Failed to toggle fam');

      setFams(
        fams.map((f) =>
          f.id === fam.id ? { ...f, active: !fam.active } : f
        )
      );

      toast.success(
        !fam.active ? 'Fam activated' : 'Fam deactivated'
      );
    } catch (error) {
      toast.error('Failed to toggle fam');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      coin_cost_monthly: '',
      max_members: '',
      perks_included: JSON.stringify(
        {
          exclusive_content: true,
          early_access: true,
          discord_role: false,
        },
        null,
        2
      ),
    });
    setIsAdding(false);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white">Loading fams...</p>
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
                  <p className="text-gray-400">You must be an approved creator to manage fams.</p>
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
              <Users className="text-yellow-400" size={32} />
              <h1 className="text-4xl font-black text-gradient-gold-red">
                Creator Fams
              </h1>
            </div>
            <p className="text-gray-400">
              Build and manage your fan club community
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
                creator.fams_enabled
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {creator.fams_enabled ? '✓ Fams Enabled' : 'Fams Disabled'}
              </div>
            </div>
          </div>

          {/* Add Fam Form */}
          {!isAdding ? (
            <div className="mb-8">
              <Button
                onClick={() => setIsAdding(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold flex items-center gap-2"
              >
                <Plus size={18} />
                Create New Fam
              </Button>
            </div>
          ) : (
            <div className="card-glow rounded-lg p-6 border border-yellow-400/30 mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Create New Fam</h3>
              <div className="space-y-4 mb-4">
                <div>
                  <Label className="text-white mb-2">Fam Name *</Label>
                  <Input
                    placeholder="e.g., VIP Members Club"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="bg-white/10 border border-white/20 text-white"
                  />
                </div>

                <div>
                  <Label className="text-white mb-2">Description</Label>
                  <Textarea
                    placeholder="Describe your fam and its benefits"
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
                    <Label className="text-white mb-2">Monthly Cost (coins) *</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 500"
                      value={formData.coin_cost_monthly}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          coin_cost_monthly: e.target.value,
                        })
                      }
                      className="bg-white/10 border border-white/20 text-white"
                    />
                  </div>

                  <div>
                    <Label className="text-white mb-2">Max Members (Optional)</Label>
                    <Input
                      type="number"
                      placeholder="Leave empty for unlimited"
                      value={formData.max_members}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          max_members: e.target.value,
                        })
                      }
                      className="bg-white/10 border border-white/20 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleAddFam}
                  disabled={isSaving}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold"
                >
                  Create Fam
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

          {/* Fams List */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Your Fams ({fams.length})</h2>

            {fams.length > 0 ? (
              <div className="space-y-4">
                {fams.map((fam) => (
                  <div
                    key={fam.id}
                    className="card-glow rounded-lg p-6 border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-white">{fam.name}</h3>
                          {fam.active && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded">
                              Active
                            </span>
                          )}
                        </div>
                        {fam.description && (
                          <p className="text-gray-400 text-sm mb-3">{fam.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Coins className="text-yellow-400" size={16} />
                            <span className="text-gray-400">Cost:</span>
                            <span className="text-yellow-400 font-semibold">
                              {fam.coin_cost_monthly}/month
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Members:</span>
                            <span className="text-white font-semibold ml-2">
                              {fam.current_members}
                              {fam.max_members ? `/${fam.max_members}` : '+'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleToggleFam(fam)}
                          className={`px-3 py-2 rounded-lg font-semibold text-sm transition ${
                            fam.active
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                          }`}
                        >
                          {fam.active ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          onClick={() => handleDeleteFam(fam.id)}
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
                <Users className="mx-auto mb-3 text-gray-400" size={32} />
                <p className="text-gray-400 mb-4">No fams created yet</p>
                <Button
                  onClick={() => setIsAdding(true)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                >
                  Create Your First Fam
                </Button>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="mt-8 bg-white/5 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Tips for Creating Great Fams</h3>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Price your fam based on the value of perks and content you offer</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Set a max member limit to create exclusivity</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Provide exclusive content and early access to fam members</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-400">•</span>
                <span>Engage regularly with your fam community</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
