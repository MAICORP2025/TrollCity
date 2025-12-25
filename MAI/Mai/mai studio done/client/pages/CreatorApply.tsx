import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, CheckCircle2, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const CATEGORIES = [
  'Music',
  'Gaming',
  'Lifestyle',
  'Talk Show',
  'Comedy',
  'Dance',
  'Art & Design',
  'Education',
  'Sports',
  'Other',
];

export default function CreatorApply() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    legal_name: '',
    creator_name: '',
    email: '',
    phone: '',
    dob: '',
    location: '',
    bio: '',
    category: 'Music',
    social_links: {
      instagram: '',
      twitter: '',
      youtube: '',
      tiktok: '',
    },
  });

  const [idFiles, setIdFiles] = useState({
    front: null as File | null,
    back: null as File | null,
  });

  const [idPreviews, setIdPreviews] = useState({
    front: '',
    back: '',
  });

  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    navigate('/signin');
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSocialLinkChange = (platform: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      social_links: {
        ...prev.social_links,
        [platform]: value,
      },
    }));
  };

  const handleFileSelect = (type: 'front' | 'back', file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Please upload an image or PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setIdFiles((prev) => ({
      ...prev,
      [type]: file,
    }));

    const reader = new FileReader();
    reader.onload = (e) => {
      setIdPreviews((prev) => ({
        ...prev,
        [type]: e.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const validateForm = (): boolean => {
    if (!formData.legal_name || !formData.creator_name || !formData.email || !formData.dob) {
      setError('Please fill in all required fields');
      return false;
    }

    if (!formData.bio || formData.bio.length < 50) {
      setError('Bio must be at least 50 characters');
      return false;
    }

    if (!idFiles.front) {
      setError('Please upload ID front image');
      return false;
    }

    if (!agree) {
      setError('Please agree to the terms');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const formPayload = new FormData();
      formPayload.append('legal_name', formData.legal_name);
      formPayload.append('creator_name', formData.creator_name);
      formPayload.append('email', formData.email);
      formPayload.append('phone', formData.phone);
      formPayload.append('dob', formData.dob);
      formPayload.append('location', formData.location);
      formPayload.append('bio', formData.bio);
      formPayload.append('category', formData.category);
      formPayload.append('social_links', JSON.stringify(formData.social_links));

      if (idFiles.front) {
        formPayload.append('id_file_front', idFiles.front);
      }
      if (idFiles.back) {
        formPayload.append('id_file_back', idFiles.back);
      }

      const response = await fetch('/api/creator/apply', {
        method: 'POST',
        body: formPayload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Application submission failed');
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Application submission failed';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center px-4">
          <div className="w-full max-w-md">
            <div className="card-glow rounded-2xl p-8 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">Application Submitted!</h1>
              <p className="text-gray-400 mb-4">
                Your creator application has been submitted successfully. Our team will review it within 3-5 business days.
              </p>
              <p className="text-gray-500 text-sm">Redirecting to home...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen pt-20 pb-10 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="card-glow rounded-2xl p-8 mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Become a Creator
            </h1>
            <p className="text-gray-400 text-lg">
              Join our creator program and start monetizing your content
            </p>
          </div>

          {error && (
            <Alert className="mb-6 bg-red-950/50 border-red-500/50">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-400">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="card-glow rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Personal Information</h2>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="legal_name" className="text-white">
                    Legal Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="legal_name"
                    name="legal_name"
                    type="text"
                    placeholder="Your full legal name"
                    value={formData.legal_name}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="creator_name" className="text-white">
                    Creator/Stage Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="creator_name"
                    name="creator_name"
                    type="text"
                    placeholder="Your creator name"
                    value={formData.creator_name}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">
                    Email <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-white">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dob" className="text-white">
                    Date of Birth <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="dob"
                    name="dob"
                    type="date"
                    value={formData.dob}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="text-white">
                    Location
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    type="text"
                    placeholder="City, Country"
                    value={formData.location}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
            </div>

            <div className="card-glow rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Creator Profile</h2>

              <div className="space-y-4 mb-4">
                <div>
                  <Label htmlFor="category" className="text-white">
                    Category <span className="text-red-400">*</span>
                  </Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-white/20">
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-white">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <Label htmlFor="bio" className="text-white">
                  Creator Bio <span className="text-red-400">*</span>
                </Label>
                <Textarea
                  id="bio"
                  name="bio"
                  placeholder="Tell us about your content and what makes you unique (minimum 50 characters)..."
                  value={formData.bio}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 resize-none"
                  rows={5}
                />
                <p className="text-xs text-gray-400">
                  {formData.bio.length}/500 characters
                </p>
              </div>
            </div>

            <div className="card-glow rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Social Links</h2>

              <div className="grid md:grid-cols-2 gap-4">
                {Object.keys(formData.social_links).map((platform) => (
                  <div key={platform} className="space-y-2">
                    <Label htmlFor={platform} className="text-white capitalize">
                      {platform}
                    </Label>
                    <Input
                      id={platform}
                      type="url"
                      placeholder={`Your ${platform} profile link`}
                      value={formData.social_links[platform as keyof typeof formData.social_links]}
                      onChange={(e) => handleSocialLinkChange(platform, e.target.value)}
                      disabled={isLoading}
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="card-glow rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-white mb-6">ID Verification</h2>

              <p className="text-gray-400 mb-6">
                Upload a clear photo of your government-issued ID (front and back). This is required to verify your identity.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-white">ID Front <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileSelect('front', e.target.files?.[0] || null)}
                      disabled={isLoading}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center cursor-pointer hover:border-white/40 transition">
                      {idPreviews.front ? (
                        <img
                          src={idPreviews.front}
                          alt="ID Front"
                          className="max-h-40 mx-auto rounded"
                        />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">Click to upload</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-white">ID Back <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileSelect('back', e.target.files?.[0] || null)}
                      disabled={isLoading}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center cursor-pointer hover:border-white/40 transition">
                      {idPreviews.back ? (
                        <img
                          src={idPreviews.back}
                          alt="ID Back"
                          className="max-h-40 mx-auto rounded"
                        />
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">Click to upload</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-950/30 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-300">
                  💡 <strong>Privacy:</strong> Your ID is stored securely. Only admins can view it for verification purposes.
                </p>
              </div>
            </div>

            <div className="card-glow rounded-2xl p-8">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  disabled={isLoading}
                  className="mt-1 cursor-pointer"
                />
                <label htmlFor="agree" className="text-gray-300 cursor-pointer">
                  <span className="text-red-400">*</span> I confirm this ID is mine and all information provided is accurate
                </label>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/')}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 neon-btn-gold text-black font-semibold h-12"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
