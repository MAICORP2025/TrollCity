import React, { useState, useEffect } from 'react';
import { createPageUrl } from '../utils';
import { supabase} from '@/api/supabaseclient';
import { 
  Upload as UploadIcon, Film, Play, Image, Coins, 
  X, Check, Loader2, Info, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Upload() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content_type: 'short',
    category: 'other',
    is_premium: false,
    coin_price: 0,
    duration_minutes: 0,
  });
  
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await supabase.auth.me();
        if (!userData.is_creator) {
          toast.error('You must be a creator to upload content');
          window.location.href = createPageUrl('BecomeCreator');
          return;
        }
        setUser(userData);
      } catch {
        supabase.auth.redirectToLogin();
      }
      setIsLoading(false);
    };

    loadUser();
  }, []);

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

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title) {
      toast.error('Please enter a title');
      return;
    }
    
    if (!videoFile) {
      toast.error('Please upload a video');
      return;
    }

    // Check movie duration limit (2 hours = 120 minutes)
    if (formData.content_type === 'movie' && formData.duration_minutes > 120) {
      toast.error('Movies cannot exceed 2 hours (120 minutes)');
      return;
    }

    setIsUploading(true);

    try {
      // Upload video
      const { file_url: videoUrl } = await supabase.integrations.Core.UploadFile({ file: videoFile });
      
      // Upload thumbnail if provided
      let thumbnailUrl = '';
      if (thumbnailFile) {
        const { file_url } = await supabase.integrations.Core.UploadFile({ file: thumbnailFile });
        thumbnailUrl = file_url;
      }

      // Create video record
      await supabase.entities.Video.create({
        ...formData,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        creator_email: user.email,
        creator_name: user.channel_name || user.full_name,
        status: 'pending',
        views: 0,
        likes: 0,
      });

      toast.success('Video uploaded successfully! It will be reviewed before publishing.');
      window.location.href = createPageUrl('CreatorDashboard');
    } catch {
      toast.error('Failed to upload video. Please try again.');
    }

    setIsUploading(false);
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
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF1744]/10 border border-[#FF1744]/30 mb-4">
            <UploadIcon className="w-4 h-4 text-[#FF1744]" />
            <span className="text-[#FF1744] text-sm font-medium">Upload Content</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Share Your Creation</h1>
          <p className="text-gray-400">Upload a short video or movie for your audience</p>
        </div>

        <Alert className="mb-6 border-[#FFD700]/30 bg-[#FFD700]/5">
          <Info className="w-4 h-4 text-[#FFD700]" />
          <AlertDescription className="text-gray-300">
            All uploads are reviewed before publishing. Make sure your content complies with our policies.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Video Upload */}
          <div className="rounded-2xl border-2 border-dashed border-gray-700 p-8 hover:border-[#FFD700]/50 transition-colors">
            {videoPreview ? (
              <div className="relative">
                <video 
                  src={videoPreview} 
                  controls 
                  className="w-full aspect-video rounded-lg"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setVideoFile(null);
                    setVideoPreview(null);
                  }}
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center cursor-pointer">
                <div className="w-16 h-16 rounded-full bg-[#FFD700]/20 flex items-center justify-center mb-4">
                  <Film className="w-8 h-8 text-[#FFD700]" />
                </div>
                <p className="text-white font-medium mb-2">Upload Video</p>
                <p className="text-sm text-gray-500">MP4, MOV, or WebM</p>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Thumbnail Upload */}
          <div>
            <Label className="text-gray-400 mb-2 block">Thumbnail (Optional)</Label>
            <div className="rounded-xl border border-gray-700 p-4">
              {thumbnailPreview ? (
                <div className="relative w-48">
                  <img 
                    src={thumbnailPreview} 
                    alt="Thumbnail" 
                    className="w-full aspect-video rounded-lg object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setThumbnailFile(null);
                      setThumbnailPreview(null);
                    }}
                    className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white h-6 w-6"
                  >
                    <X className="w-3 h-3" />
                  </Button>
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
                  <SelectItem value="short">
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4" /> Short Video
                    </div>
                  </SelectItem>
                  <SelectItem value="movie">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4" /> Full Movie
                    </div>
                  </SelectItem>
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

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isUploading}
            className="w-full neon-btn-gold text-black py-6 text-lg font-semibold"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadIcon className="w-5 h-5 mr-2" />
                Upload Video
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}