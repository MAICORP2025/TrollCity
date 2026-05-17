import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { Play, BookOpen, Grid, Globe, Users, Zap } from 'lucide-react';

interface LandingNavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  description: string;
}

export default function PublicLandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Redirect authenticated users to home
  useEffect(() => {
    if (user) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  const navItems: LandingNavItem[] = [
    {
      label: 'About',
      path: '/about',
      icon: <Globe className="w-6 h-6" />,
      description: 'Learn about Troll City'
    },
    {
      label: 'Broadcasting',
      path: '/broadcasting',
      icon: <Zap className="w-6 h-6" />,
      description: 'Start your stream'
    },
    {
      label: 'Categories',
      path: '/categories',
      icon: <Grid className="w-6 h-6" />,
      description: 'Explore content'
    },
    {
      label: 'Government',
      path: '/seo-government',
      icon: <Globe className="w-6 h-6" />,
      description: 'City governance'
    },
    {
      label: 'Creators',
      path: '/creators',
      icon: <Users className="w-6 h-6" />,
      description: 'Creator program'
    },
    {
      label: 'Go Live',
      path: '/live',
      icon: <Play className="w-6 h-6" />,
      description: 'Start broadcasting'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A]">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 mb-6">
            Welcome to Troll City
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            The ultimate social streaming platform where creators broadcast, fans engage, and everyone has a voice.
          </p>
        </div>

          {/* Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="group relative p-6 bg-[#1A1A2E] border border-purple-500/20 hover:border-purple-500/60 rounded-xl transition-all duration-300 text-left overflow-hidden"
              >
                {/* Background gradient on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-purple-400 group-hover:text-pink-400 transition-colors">
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-bold text-white">{item.label}</h3>
                  </div>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Features Section */}
          <div className="mt-24 bg-[#1A1A2E] border border-purple-500/20 rounded-xl p-8">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              Why Choose Troll City?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="text-xl font-bold text-purple-400 mb-2">Earn Money</h3>
                <p className="text-gray-400">Get paid every Friday from your streams and engagement</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">👥</div>
                <h3 className="text-xl font-bold text-purple-400 mb-2">Build Community</h3>
                <p className="text-gray-400">Connect with viewers and build your loyal fanbase</p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🎮</div>
                <h3 className="text-xl font-bold text-purple-400 mb-2">Level Up</h3>
                <p className="text-gray-400">Earn XP, unlock badges, and dominate the leaderboard</p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
