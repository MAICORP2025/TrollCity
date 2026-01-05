import { X, Send, UserPlus, MessageSquare, Gift } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";

export default function ProfileModal({ profile, onClose, onSendCoins, onGift, currentUser }) {
  const [coinAmount, setCoinAmount] = useState(100);
  const [sent, setSent] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(currentUser?.id || null);

  useEffect(() => {
    if (!currentUser) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setCurrentUserId(user.id);
      });
    } else {
        setCurrentUserId(currentUser.id);
    }
  }, [currentUser]);

  const handleSendCoins = () => {
    onSendCoins(coinAmount);
    setSent(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    toast.success(isFollowing ? `Unfollowed ${profile.username || profile.name}` : `Followed ${profile.username || profile.name}`);
  };

  const handleMessage = () => {
      toast.info(`Messaging ${profile.username || profile.name} coming soon!`);
  };

  const handleGift = () => {
      if (onGift) {
          onGift(profile);
      } else {
          toast.info("Gifting not available");
      }
  };

  const isSelf = currentUserId === profile.id;
  const displayName = profile.username || profile.name || "Unknown";
  const displayHandle = displayName.toLowerCase().replace(/\s+/g, '');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-gray-900 rounded-lg p-8 max-w-sm w-full purple-neon text-center relative border border-purple-500/30">
        <div className="absolute top-4 right-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-red-600 rounded-full flex items-center justify-center text-5xl font-bold shadow-lg shadow-purple-900/50 ring-4 ring-gray-900 overflow-hidden">
          {profile.avatar_url ? (
             <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
             displayName.charAt(0).toUpperCase()
          )}
        </div>
        
        <h2 className="text-2xl font-bold mb-1 text-white">{displayName}</h2>
        <p className="text-purple-400 mb-6 font-medium">@{displayHandle}</p>
        
        {!isSelf && (
        <div className="flex justify-center gap-4 mb-8">
            <button 
                onClick={handleFollow}
                className={`flex flex-col items-center gap-1 min-w-[64px] ${isFollowing ? 'text-green-400' : 'text-gray-300 hover:text-white'}`}
            >
                <div className={`p-3 rounded-full ${isFollowing ? 'bg-green-500/20' : 'bg-gray-800 hover:bg-gray-700'} transition-colors`}>
                    <UserPlus size={20} />
                </div>
                <span className="text-xs font-bold">{isFollowing ? 'Following' : 'Follow'}</span>
            </button>
            
            <button 
                onClick={handleMessage}
                className="flex flex-col items-center gap-1 min-w-[64px] text-gray-300 hover:text-white"
            >
                <div className="p-3 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors">
                    <MessageSquare size={20} />
                </div>
                <span className="text-xs font-bold">Message</span>
            </button>

            <button 
                onClick={handleGift}
                className="flex flex-col items-center gap-1 min-w-[64px] text-pink-400 hover:text-pink-300"
            >
                <div className="p-3 rounded-full bg-pink-500/20 hover:bg-pink-500/30 transition-colors border border-pink-500/30">
                    <Gift size={20} />
                </div>
                <span className="text-xs font-bold">Gift</span>
            </button>
        </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-3 border border-white/5">
            <div className="text-xl font-bold text-white">2.5K</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Followers</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-white/5">
            <div className="text-xl font-bold text-white">842</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Following</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 border border-white/5">
            <div className="text-xl font-bold text-white">1.2K</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Gifts</div>
          </div>
        </div>
        
        {!isSelf && (
          !sent ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold block mb-2">Send Coins</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={coinAmount}
                  onChange={(e) =>
                    setCoinAmount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="flex-1 bg-gray-800 text-white rounded px-3 py-2 text-center purple-neon"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {[50, 100, 500].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setCoinAmount(amount)}
                  className={`flex-1 py-1 text-xs rounded font-bold transition-all ${
                    coinAmount === amount
                      ? "bg-purple-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>
            <button
              onClick={handleSendCoins}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-700 hover:to-red-700 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
            >
              <Send size={18} />
              Send {coinAmount} Coins
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">✨</div>
            <p className="text-lg font-bold text-purple-300">Coins Sent!</p>
            <p className="text-sm text-gray-400">+{coinAmount} coins</p>
          </div>
        ))}
      </div>
    </div>
  );
}
