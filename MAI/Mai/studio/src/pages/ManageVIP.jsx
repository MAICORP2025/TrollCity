import React, { useState, useEffect } from 'react';
import { createPageUrl } from '../utils';
import { supabase} from '@/api/supabaseclient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Crown, Plus, Edit, Trash2, Save, X, 
  Coins, Calendar, Check, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function ManageVIP() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    coin_price: 100,
    duration_days: 30,
    perks: [],
    badge_color: '#FFD700',
    active: true
  });

  const [perkInput, setPerkInput] = useState('');

  const loadUser = async () => {
    try {
      const userData = await supabase.auth.me();
      if (!userData.is_creator) {
        toast.error('Only creators can manage VIP packages');
        window.location.href = createPageUrl('CreatorDashboard');
        return;
      }
      setUser(userData);
    } catch { /* ignore */ }
    setIsLoading(false);
  };

  useEffect(() => {
    const fetchUser = async () => {
      await loadUser();
    };
    fetchUser();
  }, []);

  const { data: vipPackages = [] } = useQuery({
    queryKey: ['my-vip-packages', user?.email],
    queryFn: () => supabase.entities.VIPPackage.filter({ creator_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const { data: subscribers = [] } = useQuery({
    queryKey: ['my-subscribers', user?.email],
    queryFn: () => supabase.entities.Subscription.filter({ creator_email: user.email, status: 'active' }),
    enabled: !!user?.email,
  });

  const handleOpenDialog = (pkg = null) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        name: pkg.name,
        description: pkg.description,
        coin_price: pkg.coin_price,
        duration_days: pkg.duration_days,
        perks: pkg.perks || [],
        badge_color: pkg.badge_color || '#FFD700',
        active: pkg.active
      });
    } else {
      setEditingPackage(null);
      setFormData({
        name: '',
        description: '',
        coin_price: 100,
        duration_days: 30,
        perks: [],
        badge_color: '#FFD700',
        active: true
      });
    }
    setShowDialog(true);
  };

  const handleAddPerk = () => {
    if (!perkInput.trim()) return;
    setFormData({
      ...formData,
      perks: [...formData.perks, perkInput.trim()]
    });
    setPerkInput('');
  };

  const handleRemovePerk = (index) => {
    setFormData({
      ...formData,
      perks: formData.perks.filter((_, i) => i !== index)
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description || formData.coin_price <= 0) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSaving(true);

    try {
      if (editingPackage) {
        await supabase.entities.VIPPackage.update(editingPackage.id, {
          ...formData,
          creator_email: user.email
        });
        toast.success('Package updated');
      } else {
        await supabase.entities.VIPPackage.create({
          ...formData,
          creator_email: user.email
        });
        toast.success('Package created');
      }
      queryClient.invalidateQueries(['my-vip-packages']);
      setShowDialog(false);
    } catch {
      toast.error('Failed to save package');
    }

    setIsSaving(false);
  };

  const handleDelete = async (pkg) => {
    if (!confirm('Delete this VIP package? Active subscriptions will continue until expiry.')) {
      return;
    }

    try {
      await supabase.entities.VIPPackage.delete(pkg.id);
      toast.success('Package deleted');
      queryClient.invalidateQueries(['my-vip-packages']);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleToggleActive = async (pkg) => {
    try {
      await supabase.entities.VIPPackage.update(pkg.id, { active: !pkg.active });
      toast.success(pkg.active ? 'Package deactivated' : 'Package activated');
      queryClient.invalidateQueries(['my-vip-packages']);
    } catch {
      toast.error('Failed to update');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-[#FFD700]/20">
              <Crown className="w-8 h-8 text-[#FFD700]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">VIP Packages</h1>
              <p className="text-gray-400">Create and manage your fan memberships</p>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()} className="neon-btn-gold text-black">
            <Plus className="w-4 h-4 mr-2" />
            New Package
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
            <p className="text-gray-400 text-sm">Total Packages</p>
            <p className="text-2xl font-bold text-white">{vipPackages.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
            <p className="text-gray-400 text-sm">Active Subscribers</p>
            <p className="text-2xl font-bold text-white">{subscribers.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/30">
            <p className="text-gray-400 text-sm">Monthly Revenue</p>
            <p className="text-2xl font-bold text-[#FFD700]">
              {subscribers.reduce((sum, s) => {
                const pkg = vipPackages.find(p => p.id === s.package_id);
                return sum + (pkg?.coin_price || 0);
              }, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Packages */}
        {vipPackages.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-gray-800 bg-gray-900/30">
            <Crown className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No VIP Packages Yet</h3>
            <p className="text-gray-400 mb-6">Create your first VIP package to offer exclusive perks to your fans</p>
            <Button onClick={() => handleOpenDialog()} className="neon-btn-gold text-black">
              <Plus className="w-4 h-4 mr-2" />
              Create Package
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {vipPackages.map((pkg) => {
              const pkgSubscribers = subscribers.filter(s => s.package_id === pkg.id);
              return (
                <div 
                  key={pkg.id}
                  className={`p-6 rounded-2xl border ${
                    pkg.active ? 'border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/10 to-transparent' : 'border-gray-800 bg-gray-900/30 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{pkg.name}</h3>
                      <p className="text-sm text-gray-400 mt-1">{pkg.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleOpenDialog(pkg)}
                        className="text-gray-400 hover:text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(pkg)}
                        className="text-red-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Coins className="w-4 h-4" />
                        <span className="text-sm">Price</span>
                      </div>
                      <span className="text-[#FFD700] font-bold">{pkg.coin_price} coins</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Duration</span>
                      </div>
                      <span className="text-white font-medium">{pkg.duration_days} days</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Crown className="w-4 h-4" />
                        <span className="text-sm">Subscribers</span>
                      </div>
                      <span className="text-white font-medium">{pkgSubscribers.length}</span>
                    </div>
                  </div>

                  {pkg.perks && pkg.perks.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Perks:</p>
                      <ul className="space-y-1">
                        {pkg.perks.map((perk, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                            <Check className="w-3 h-3 text-[#FFD700]" />
                            {perk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button
                    onClick={() => handleToggleActive(pkg)}
                    variant="outline"
                    className={`w-full ${
                      pkg.active 
                        ? 'border-yellow-500 text-yellow-500 hover:bg-yellow-500/10' 
                        : 'border-green-500 text-green-500 hover:bg-green-500/10'
                    }`}
                  >
                    {pkg.active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Dialog for Create/Edit */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPackage ? 'Edit VIP Package' : 'Create VIP Package'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Package Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Gold Membership"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe what fans get with this package"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coin_price">Price (Coins)</Label>
                  <Input
                    id="coin_price"
                    type="number"
                    value={formData.coin_price}
                    onChange={(e) => setFormData({...formData, coin_price: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label htmlFor="duration_days">Duration (Days)</Label>
                  <Input
                    id="duration_days"
                    type="number"
                    value={formData.duration_days}
                    onChange={(e) => setFormData({...formData, duration_days: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="badge_color">Badge Color</Label>
                <Input
                  id="badge_color"
                  type="color"
                  value={formData.badge_color}
                  onChange={(e) => setFormData({...formData, badge_color: e.target.value})}
                />
              </div>
              <div>
                <Label>Perks</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={perkInput}
                    onChange={(e) => setPerkInput(e.target.value)}
                    placeholder="Add a perk"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPerk()}
                  />
                  <Button onClick={handleAddPerk} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <ul className="space-y-1">
                  {formData.perks.map((perk, i) => (
                    <li key={i} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                      <span>{perk}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemovePerk(i)}
                        className="text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({...formData, active: checked})}
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="neon-btn-gold text-black">
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingPackage ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}