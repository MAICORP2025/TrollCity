import { Gift, MessageCircle, Heart, Crown } from "lucide-react";

const ReelActions: React.FC<{ post: any; onCommentsClick?: () => void }> = ({ post, onCommentsClick }) => {
  return (
    <div className="absolute right-3 bottom-24 flex flex-col gap-4 items-center">
      <button className="bg-white/20 p-3 rounded-full hover:bg-white/40 transition">
        <Heart className="text-red-400" />
      </button>
      <button className="bg-white/20 p-3 rounded-full hover:bg-white/40 transition">
        <Gift className="text-yellow-400" />
      </button>
      <button
        onClick={onCommentsClick}
        className="bg-white/20 p-3 rounded-full hover:bg-white/40 transition"
      >
        <MessageCircle className="text-blue-300" />
      </button>
      <button className="bg-white/20 p-3 rounded-full hover:bg-white/40 transition">
        <Crown className="text-purple-300" />
      </button>

      <div className="text-xs text-gray-300 mt-4">
        {post.coins_earned?.toLocaleString() || 0} coins
      </div>
    </div>
  );
};

export default ReelActions;