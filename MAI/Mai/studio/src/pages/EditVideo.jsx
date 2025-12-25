import React, { useState, useEffect } from 'react';
import { createPageUrl } from '../utils';
import { supabase} from '@/api/supabaseclient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Edit, Film, Trash2, Image, Coins, 
  Save, Loader2, AlertCircle, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function EditVideo() {
  const urlParams = new URLSearchParams(window.location.search);
  const videoId = urlParams.get('id');
  const queryClient = useQueryClient();
  
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_type: 'short',
    category: 'other',
    is_premium: false,
    coin_price: 0,
    duration_minutes: 0,
    featured: false,
  });
  
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  const loadUser = async () => {
    try {
      const userData = await supabase.auth.me();
      if (!userData.is_creator) {
        toast.error('You must be a creator to edit videos');
        window.location.href = createPageUrl('CreatorDashboard');
        return;
      }
      setUser(userData);
    } catch {
      supabase.auth.redirectToLogin();
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const fetchUser = async () => {
      await loadUser();
    };
    fetchUser();
  }, []);

  const { data: video, isLoading: loadingVideo } = useQuery({
    queryKey: ['video', videoId],
    queryFn: async () => {
      const videos = await supabase.entities.Video.filter({ id: videoId });
      return videos[0];
    },
    enabled: !!videoId && !!user,
  });

  useEffect(() => {
    if (video) {
      if (video.creator_email !== user?.email && user?.role !== 'admin') {
        toast.error('You can only edit your own videos');
        window.location.href = createPageUrl('CreatorDashboard');
        return;
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        title: video.title || '',
        description: video.description || '',
        content_type: video.content_type || 'short',
        category: video.category || 'other',
        is_premium: video.is_premium || false,
        coin_price: video.coin_price || 0,
        duration_minutes: video.duration_minutes || 0,
        featured: video.featured || false,
      });
      setThumbnailPreview(video.thumbnail_url);
    }
  }, [video, user]);

  const categories = [
    { value: 'action', label: 'Action' },
    { value: 'comedy', label: 'Comedy' },
    { value: 'drama', label: 'Drama' },
    { value: 'horror', label: 'Horror' },
    { value: 'documentary', label: 'Documentary' },
    { value: 'music', label: 'Music' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'education', label: 'Education' },
    { value: 'lifestyle', label: 'Lifestyle' },
    { value: 'sports', label: 'Sports' },
    { value: 'other', label: 'Other' },
  ];

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.title) {
      toast.error('Please enter a title');
      return;
    }

    if (formData.content_type === 'movie' && formData.duration_minutes > 120) {
      toast.error('Movies cannot exceed 2 hours (120 minutes)');
      return;
    }

    setIsSaving(true);

    try {
      let updateData = { ...formData };
      
      // Upload new thumbnail if changed
      if (thumbnailFile) {
        const { file_url } = await supabase.integrations.Core.UploadFile({ file: thumbnailFile });
        updateData.thumbnail_url = file_url;
      }

      await supabase.entities.Video.update(video.id, updateData);
      toast.success('Video updated successfully!');
      queryClient.invalidateQueries(['video', videoId]);
      queryClient.invalidateQueries(['my-videos']);
      window.location.href = createPageUrl('CreatorDashboard');
    } catch {
      toast.error('Failed to update video');
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);

    try {
      await supabase.entities.Video.delete(video.id);
      toast.success('Video deleted');
      window.location.href = createPageUrl('CreatorDashboard');
    } catch {
      toast.error('Failed to delete video');
    }

    setIsDeleting(false);
  };

  if (isLoading || loadingVideo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Video not found</h1>
          <Button onClick={() => window.location.href = createPageUrl('CreatorDashboard')} className="neon-btn-gold text-black">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => window.location.href = createPageUrl('CreatorDashboard')}
          className="mb-6 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/30 mb-4">
            <Edit className="w-4 h-4 text-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-medium">Edit Video</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Update Your Content</h1>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Current Thumbnail */}
          <div>
            <Label className="text-gray-400 mb-2 block">Current Thumbnail</Label>
            <div className="rounded-xl border border-gray-700 p-4">
              {thumbnailPreview ? (
                <div className="relative w-full max-w-md">
                  <img 
                    src={thumbnailPreview} 
                    alt="Thumbnail" 
                    className="w-full aspect-video rounded-lg object-cover"
                  />
                  <label className="absolute bottom-2 right-2 cursor-pointer">
                    <div className="px-3 py-1 rounded bg-black/70 hover:bg-black/90 text-white text-sm flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      Change
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-4 cursor-pointer">
                  <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center">
                    <Image className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white">Add a thumbnail</p>
                    <p className="text-xs text-gray-500">PNG or JPG</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div>
            <Label className="text-gray-400">Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter a catchy title"
              className="mt-2 bg-gray-900 border-gray-700 text-white"
            />
          </div>

          {/* Description */}
          <div>
            <Label className="text-gray-400">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell viewers about your content..."
              className="mt-2 bg-gray-900 border-gray-700 text-white h-32"
            />
          </div>

          {/* Content Type & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Content Type</Label>
              <Select
                value={formData.content_type}
                onValueChange={(value) => setFormData({ ...formData, content_type: value })}
              >
                <SelectTrigger className="mt-2 bg-gray-900 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short Video</SelectItem>
                  <SelectItem value="movie">Full Movie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-400">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className="mt-2 bg-gray-900 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration */}
          <div>
            <Label className="text-gray-400">Duration (minutes)</Label>
            <Input
              type="number"
              min="0"
              max={formData.content_type === 'movie' ? 120 : undefined}
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
              className="mt-2 bg-gray-900 border-gray-700 text-white w-32"
            />
            {formData.content_type === 'movie' && (
              <p className="text-xs text-gray-500 mt-1">Maximum: 120 minutes (2 hours)</p>
            )}
          </div>

          {/* Premium Settings */}
          <div className="rounded-xl border border-gray-700 p-6 bg-gray-900/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-white font-medium">Premium Content</h3>
                <p className="text-sm text-gray-500">Require MAI Coins to unlock</p>
              </div>
              <Switch
                checked={formData.is_premium}
                onCheckedChange={(checked) => setFormData({ ...formData, is_premium: checked })}
              />
            </div>
            
            {formData.is_premium && (
              <div>
                <Label className="text-gray-400">Coin Price</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Coins className="w-5 h-5 text-[#FFD700]" />
                  <Input
                    type="number"
                    min="1"
                    value={formData.coin_price}
                    onChange={(e) => setFormData({ ...formData, coin_price: parseInt(e.target.value) || 0 })}
                    className="bg-gray-900 border-gray-700 text-white w-32"
                  />
                  <span className="text-gray-500">MAI Coins</span>
                </div>
              </div>
            )}
          </div>

          {/* Admin Controls */}
          {user?.role === 'admin' && (
            <div className="rounded-xl border border-[#FF1744]/30 p-6 bg-[#FF1744]/5">
              <h3 className="text-white font-medium mb-4">Admin Controls</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-gray-400">Featured</Label>
                  <p className="text-sm text-gray-500">Show on homepage</p>
                </div>
                <Switch
                  checked={formData.featured}
                  onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1 neon-btn-gold text-black py-6 text-lg font-semibold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting}
              className="border-red-500 text-red-500 hover:bg-red-500/10 py-6"
            >
              {isDeleting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}