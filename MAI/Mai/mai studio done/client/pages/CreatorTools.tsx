import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { Loader2, AlertCircle, Sparkles, Users, Heart, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

interface CreatorProfile {
  id: string;
  user_id: string;
  creator_name: string;
  bio: string;
  category: string;
  perks_enabled: boolean;
  messaging_paid_enabled: boolean;
  fams_enabled: boolean;
  created_at: string;
}

export default function CreatorTools() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/signin');
      return;
    }

    const fetchCreatorProfile = async () => {
      try {
        const response = await fetch(`/api/creator/${user.id}`);
        if (!response.ok) {
          throw new Error('Not an approved creator');
        }
        const data = await response.json();
        setCreator(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load creator profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCreatorProfile();
  }, [user, authLoading, navigate]);

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-yellow-400" size={32} />
            <p className="text-white">Loading creator tools...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !creator) {
    return (
      <Layout>
        <div className="min-h-screen pt-20 px-4">
          <div className="container-wide max-w-2xl">
            <div className="card-glow rounded-lg p-8 border border-red-500/20">
              <div className="flex gap-4">
                <AlertCircle className="text-red-400 flex-shrink-0" size={24} />
                <div>
                  <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
                  <p className="text-gray-400 mb-4">
                    {error || 'You must be an approved creator to access these tools.'}
                  </p>
                  <button
                    onClick={() => navigate('/creator-apply')}
                    className="px-6 py-2 bg-yellow-400 text-black font-semibold rounded-lg hover:bg-yellow-300 transition"
                  >
                    Apply to be a Creator
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const tools = [
    {
      id: 'perks',
      title: 'Creator Perks',
      description: 'Create and manage exclusive perks for your fans',
      icon: Sparkles,
      path: '/creator-perks',
      enabled: creator.perks_enabled,
      badge: 'Monetization',
    },
    {
      id: 'messaging',
      title: 'Paid Messages',
      description: 'Charge fans for personalized messages',
      icon: Heart,
      path: '/creator-message-pricing',
      enabled: creator.messaging_paid_enabled,
      badge: 'Monetization',
    },
    {
      id: 'fams',
      title: 'Creator Fams',
      description: 'Build and manage your fan club community',
      icon: Users,
      path: '/creator-fams',
      enabled: creator.fams_enabled,
      badge: 'Community',
    },
    {
      id: 'analytics',
      title: 'Analytics',
      description: 'Track your earnings and fan engagement',
      icon: Zap,
      path: '/creator-earnings',
      enabled: true,
      badge: 'Insights',
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen pt-20 px-4 pb-20">
        <div className="container-wide max-w-6xl">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-4xl font-black text-gradient-gold-red mb-2">
                  Creator Tools
                </h1>
                <p className="text-gray-400">
                  Manage your creator profile, perks, and earnings
                </p>
              </div>
            </div>

            {/* Creator Info Card */}
            <div className="card-glow rounded-lg p-6 border border-white/10">
              <div className="grid md:grid-cols-3 gap-8">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Creator Name</p>
                  <p className="text-white font-semibold text-lg">{creator.creator_name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Category</p>
                  <p className="text-white font-semibold text-lg">{creator.category}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Member Since</p>
                  <p className="text-white font-semibold text-lg">
                    {new Date(creator.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  onClick={() => navigate(tool.path)}
                  className="card-glow rounded-lg p-6 border border-white/10 hover:border-yellow-400/50 transition cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-white/5 rounded-lg group-hover:bg-yellow-400/10 transition">
                      <Icon className="text-yellow-400" size={24} />
                    </div>
                    <span className="px-2 py-1 bg-white/5 rounded text-xs font-semibold text-gray-300 group-hover:text-yellow-400 transition">
                      {tool.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-yellow-400 transition">
                    {tool.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">{tool.description}</p>

                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${
                      tool.enabled
                        ? 'text-green-400'
                        : 'text-gray-500'
                    }`}>
                      {tool.enabled ? '✓ Enabled' : 'Disabled'}
                    </span>
                    <span className="text-yellow-400 group-hover:translate-x-1 transition">
                      →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
