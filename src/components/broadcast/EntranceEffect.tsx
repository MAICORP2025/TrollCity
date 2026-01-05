import { useEffect, useState } from "react";

interface EntranceEffectProps {
  username: string;
  role: string;
  profile?: {
    rgb_username_expires_at?: string;
  };
}

export default function EntranceEffect({ username, role, profile }: EntranceEffectProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // ✅ Show entrance effect for 5 seconds as requested
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  const roleConfig: Record<string, { color: string; emoji: string; title: string }> = {
    admin: {
      color: "from-red-600 to-red-800",
      emoji: "🔴",
      title: "ADMIN",
    },
    lead_troll_officer: {
      color: "from-purple-600 to-purple-800",
      emoji: "👑",
      title: "LEAD TROLL OFFICER",
    },
    troll_officer: {
      color: "from-blue-600 to-blue-800",
      emoji: "⚔️",
      title: "TROLL OFFICER",
    },
    troller: {
        color: "from-green-500 to-green-700",
        emoji: "🧟",
        title: "TROLLER"
    },
    og_user: {
        color: "from-yellow-500 to-yellow-700",
        emoji: "⭐",
        title: "OG USER"
    },
    default: {
        color: "from-gray-400 to-gray-600",
        emoji: "👋",
        title: "USER"
    }
  };

  const config = roleConfig[role] || roleConfig.default;
  const hasRgb = profile?.rgb_username_expires_at && new Date(profile.rgb_username_expires_at) > new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-pulse pointer-events-none">
      <div className="entrance-text text-center">
        <div className={`text-8xl mb-4 glow`}>{config.emoji}</div>
        <div className={`text-6xl font-black text-transparent bg-gradient-to-r ${config.color} bg-clip-text mb-4 ${hasRgb ? 'rgb-username text-white !bg-none' : ''}`}>
          {username.toUpperCase()}
        </div>
        <div className={`text-3xl font-bold text-white tracking-widest mb-6`}>
          {config.title}
        </div>
        <div className="text-lg text-gray-300">
          has entered the stream
        </div>
      </div>
    </div>
  );
}
