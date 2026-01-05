import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Video, Gift, Users, Zap } from 'lucide-react';
import { useAuthStore } from '../lib/store';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleEnterTrollCity = () => {
    if (user) {
      navigate('/live');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-block animate-bounce-slow">
            <Crown className="w-20 h-20 text-yellow-400 mx-auto drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 drop-shadow-sm">
            TROLL CITY
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            The ultimate streaming playground where chaos meets reward. 
            Watch streams, earn coins, and unleash mayhem.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <button
              onClick={handleEnterTrollCity}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold text-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(147,51,234,0.5)] flex items-center gap-2 group"
            >
              <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Enter City
            </button>
            
            <button
              onClick={() => navigate('/about')}
              className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-bold text-xl transition-all hover:scale-105 border border-zinc-700"
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          {[
            {
              icon: Video,
              title: "Live Streaming",
              desc: "Watch your favorite chaos agents live",
              color: "text-blue-400"
            },
            {
              icon: Gift,
              title: "Earn Rewards",
              desc: "Get paid just for watching and engaging",
              color: "text-green-400"
            },
            {
              icon: Users,
              title: "Community",
              desc: "Join factions and dominate the city",
              color: "text-pink-400"
            }
          ].map((feature, i) => (
            <div 
              key={i}
              className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 p-8 rounded-2xl hover:border-purple-500/50 transition-colors group"
            >
              <feature.icon className={`w-12 h-12 ${feature.color} mb-4 group-hover:scale-110 transition-transform`} />
              <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Force rebuild trigger
