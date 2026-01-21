import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { 
  Gamepad2, 
  Users, 
  ShoppingCart, 
  Video, 
  Coins, 
  TrendingUp,
  Shield,
  Zap,
  Star,
  ArrowRight,
  Play,
  Sparkles
} from 'lucide-react';

// Animated gradient background
const AnimatedGradient = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-slate-900 to-cyan-900 animate-gradient-shift" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-600/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-cyan-600/20 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-pink-600/20 via-transparent to-transparent" />
      <style>
        {`
          @keyframes gradient-shift {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
          .animate-gradient-shift {
            animation: gradient-shift 10s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
};

// Floating particles effect
const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/40 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float-particle ${5 + Math.random() * 10}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
      <style>
        {`
          @keyframes float-particle {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0; }
            10% { opacity: 0.6; }
            90% { opacity: 0.6; }
            50% { transform: translateY(-100px) translateX(50px); }
          }
        `}
      </style>
    </div>
  );
};

// Feature card component
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  delay: number;
}

const FeatureCard = ({ icon, title, description, gradient, delay }: FeatureCardProps) => {
  return (
    <div 
      className="group relative p-6 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-purple-500/20 hover:border-cyan-400/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl bg-gradient-to-br ${gradient} blur-xl`} />
      <div className="relative z-10">
        <div className="mb-4 p-3 bg-gradient-to-br from-purple-600/20 to-cyan-600/20 rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          {title}
        </h3>
        <p className="text-slate-300 text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};

// Stats component
const StatsSection = () => {
  const stats = [
    { icon: <Users className="w-6 h-6" />, value: "10K+", label: "Active Users" },
    { icon: <Video className="w-6 h-6" />, value: "500+", label: "Live Streams Daily" },
    { icon: <Coins className="w-6 h-6" />, value: "1M+", label: "Troll Coins Earned" },
    { icon: <TrendingUp className="w-6 h-6" />, value: "24/7", label: "Entertainment" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
      {stats.map((stat, index) => (
        <div 
          key={index}
          className="text-center p-6 bg-slate-900/30 backdrop-blur-sm rounded-xl border border-purple-500/10 hover:border-cyan-400/30 transition-all duration-300 animate-fade-in-up"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex justify-center mb-3 text-cyan-400">
            {stat.icon}
          </div>
          <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-1">
            {stat.value}
          </div>
          <div className="text-sm text-slate-400">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
};

export default function Home() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const features = [
    {
      icon: <Video className="w-8 h-8 text-purple-400" />,
      title: "Live Streaming",
      description: "Go live and connect with your audience in real-time. Stream games, music, or just hang out with friends.",
      gradient: "from-purple-600/20 to-pink-600/20",
    },
    {
      icon: <Users className="w-8 h-8 text-cyan-400" />,
      title: "Join Families",
      description: "Create or join families to build your community. Compete for top rankings and exclusive rewards.",
      gradient: "from-cyan-600/20 to-blue-600/20",
    },
    {
      icon: <ShoppingCart className="w-8 h-8 text-pink-400" />,
      title: "Troll Mart",
      description: "Shop for exclusive items, apartments, and customizations. Build your virtual empire in Troll City.",
      gradient: "from-pink-600/20 to-purple-600/20",
    },
    {
      icon: <Gamepad2 className="w-8 h-8 text-purple-400" />,
      title: "Play Games",
      description: "Enjoy interactive games like Trolls Town and Family Feud. Earn coins and compete with others.",
      gradient: "from-purple-600/20 to-cyan-600/20",
    },
    {
      icon: <Coins className="w-8 h-8 text-yellow-400" />,
      title: "Earn Troll Coins",
      description: "Complete tasks, stream, and engage with the community to earn Troll Coins and unlock rewards.",
      gradient: "from-yellow-600/20 to-orange-600/20",
    },
    {
      icon: <Shield className="w-8 h-8 text-cyan-400" />,
      title: "Safe Community",
      description: "Moderated community with family-friendly content. Report features and active moderation team.",
      gradient: "from-cyan-600/20 to-teal-600/20",
    },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-slate-950">
      {/* Animated Background */}
      <AnimatedGradient />
      <FloatingParticles />

      {/* Content */}
      <div className="relative z-10 min-h-dvh flex flex-col">
        
        {/* Hero Section */}
        <section className="flex-1 flex items-center justify-center px-4 py-20 safe-top">
          <div className="max-w-6xl mx-auto text-center">
            
            {/* Main Heading */}
            <div className="mb-8 animate-fade-in">
              <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent animate-gradient-text">
                Welcome to Troll City
              </h1>
              <p className="text-xl md:text-2xl text-slate-300 mb-6">
                Stream, Play, Connect & Earn in the Ultimate Online Community
              </p>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Join thousands of creators and viewers in Troll City - where live streaming meets gaming, shopping, and social connection.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              {!user ? (
                <>
                  <button
                    onClick={() => navigate('/signup')}
                    className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl font-semibold text-lg shadow-lg shadow-purple-500/50 hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105 flex items-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    Join Troll City
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-8 py-4 bg-slate-900/50 backdrop-blur-md border-2 border-purple-500/50 rounded-xl font-semibold text-lg hover:border-cyan-400/50 hover:bg-slate-800/50 transition-all duration-300 hover:scale-105"
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/go-live')}
                    className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold text-lg shadow-lg shadow-purple-500/50 hover:shadow-pink-500/50 transition-all duration-300 hover:scale-105 flex items-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Go Live Now
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={() => navigate('/feed')}
                    className="px-8 py-4 bg-slate-900/50 backdrop-blur-md border-2 border-cyan-500/50 rounded-xl font-semibold text-lg hover:border-cyan-400/70 hover:bg-slate-800/50 transition-all duration-300 hover:scale-105"
                  >
                    Explore Feed
                  </button>
                </>
              )}
            </div>

            {/* Quick Features Preview */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-400 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/30 backdrop-blur-sm rounded-full border border-purple-500/20">
                <Zap className="w-4 h-4 text-yellow-400" />
                Free to Join
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/30 backdrop-blur-sm rounded-full border border-purple-500/20">
                <Star className="w-4 h-4 text-cyan-400" />
                Earn Rewards
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/30 backdrop-blur-sm rounded-full border border-purple-500/20">
                <Shield className="w-4 h-4 text-purple-400" />
                Safe & Moderated
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-4 py-16 bg-slate-950/50 backdrop-blur-md border-y border-purple-500/10">
          <div className="max-w-6xl mx-auto">
            <StatsSection />
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Everything You Need
              </h2>
              <p className="text-xl text-slate-400">
                A complete platform for creators and community members
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  {...feature}
                  delay={index * 100}
                />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 py-20 bg-gradient-to-br from-purple-900/30 via-slate-900/30 to-cyan-900/30 backdrop-blur-md border-t border-purple-500/10">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Ready to Join the City?
            </h2>
            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Start streaming, playing games, earning coins, and connecting with an amazing community today.
            </p>
            <button
              onClick={() => navigate(user ? '/feed' : '/signup')}
              className="group relative px-10 py-5 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 rounded-xl font-semibold text-xl shadow-2xl shadow-purple-500/50 hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-105 flex items-center gap-3 mx-auto"
            >
              <Sparkles className="w-6 h-6" />
              {user ? 'Enter Troll City' : 'Join Free Now'}
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
        </section>

        {/* Footer safe area */}
        <div className="safe-bottom" />
      </div>

      {/* Animations */}
      <style>
        {`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes fade-in-up {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes gradient-text {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          
          .animate-fade-in {
            animation: fade-in 1s ease-out forwards;
          }
          
          .animate-fade-in-up {
            animation: fade-in-up 0.8s ease-out forwards;
            opacity: 0;
          }
          
          .animate-gradient-text {
            background-size: 200% auto;
            animation: gradient-text 3s ease-in-out infinite;
          }
        `}
      </style>
    </div>
  );
}
