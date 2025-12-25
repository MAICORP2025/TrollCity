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
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CreateProfile() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, createProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteCategory, setFavoriteCategory] = useState<'shorts' | 'movies' | 'creator'>('shorts');
  const [error, setError] = useState('');
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

  if (!user || user.profile_complete) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!displayName || !bio) {
      setError('Please fill in all fields');
      return;
    }

    if (displayName.length < 2) {
      setError('Display name must be at least 2 characters');
      return;
    }

    setIsLoading(true);
    try {
      await createProfile({
        display_name: displayName,
        bio,
        favorite_category: favoriteCategory,
      });
      navigate('/');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Profile creation failed';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen pt-20 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="card-glow rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">
              Complete Your Profile
            </h1>
            <p className="text-gray-400 text-center mb-8">
              Let us know a bit about you
            </p>

            {error && (
              <Alert className="mb-6 bg-red-950/50 border-red-500/50">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-white">
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  type="text"
                  placeholder="John Creator"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-white">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={isLoading}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 resize-none"
                  rows={4}
                />
                <p className="text-xs text-gray-400">
                  {bio.length}/200 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-white">
                  Favorite Category
                </Label>
                <Select value={favoriteCategory} onValueChange={(value: any) => setFavoriteCategory(value)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-white/20">
                    <SelectItem value="shorts" className="text-white">
                      Shorts
                    </SelectItem>
                    <SelectItem value="movies" className="text-white">
                      Movies
                    </SelectItem>
                    <SelectItem value="creator" className="text-white">
                      Creator Content
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full neon-btn-gold text-black font-semibold h-12 mt-6"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Continue to Home'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
