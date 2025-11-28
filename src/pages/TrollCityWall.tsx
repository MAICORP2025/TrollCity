import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../lib/store";
import { toast } from "sonner";
import ClickableUsername from "../components/ClickableUsername";

interface TrollPost {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  coins_earned: number;
  created_at: string;
  user_profiles?: {
    username: string;
    avatar_url: string | null;
  }[] | null;
  reactions?: {
    id: string;
    reaction_type: string;
  }[];
}

const TrollCityWall: React.FC = () => {
  const { user, profile } = useAuthStore();
  const [posts, setPosts] = useState<TrollPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const GIFT_COST = 50; // 50 coins per "Troll Heart" (adjust later)

  const loadPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("troll_posts")
        .select(
          `
          id,
          user_id,
          content,
          image_url,
          coins_earned,
          created_at,
          user_profiles!user_id (
            username,
            avatar_url
          ),
          troll_post_reactions (
            id,
            reaction_type
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error("Error loading posts:", err);
      toast.error("Failed to load Troll City feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const createPost = async () => {
    if (!user || !profile) {
      toast.error("You must be logged in to post");
      return;
    }
    if (!content.trim() && !imageUrl.trim()) {
      toast.error("Write something or add an image");
      return;
    }

    try {
      setCreating(true);
      const { data, error } = await supabase
        .from("troll_posts")
        .insert({
          user_id: profile.id,
          content: content.trim() || null,
          image_url: imageUrl.trim() || null,
        })
        .select(
          `
          id,
          user_id,
          content,
          image_url,
          coins_earned,
          created_at,
          user_profiles!user_id (
            username,
            avatar_url
          ),
          troll_post_reactions (
            id,
            reaction_type
          )
        `
        )
        .single();

      if (error) throw error;

      setPosts((prev) => [data as TrollPost, ...prev]);
      setContent("");
      setImageUrl("");
      toast.success("Posted to Troll City Wall");
    } catch (err) {
      console.error("Error creating post:", err);
      toast.error("Failed to create post");
    } finally {
      setCreating(false);
    }
  };

  const sendPostGift = async (post: TrollPost) => {
    if (!user || !profile) {
      toast.error("Login required to send gifts");
      return;
    }

    // don't gift yourself (optional)
    if (post.user_id === profile.id) {
      toast.error("You can't gift yourself… yet 😈");
      return;
    }

    try {
      const totalCoins =
        Number(profile.paid_coin_balance || 0) +
        Number(profile.free_coin_balance || 0);

      if (totalCoins < GIFT_COST) {
        toast.error("Not enough coins. Visit the store.");
        return;
      }

      // prefer paid coins first
      let paid = Number(profile.paid_coin_balance || 0);
      let free = Number(profile.free_coin_balance || 0);
      let remaining = GIFT_COST;

      const usePaid = Math.min(remaining, paid);
      paid -= usePaid;
      remaining -= usePaid;

      const useFree = Math.min(remaining, free);
      free -= useFree;
      remaining -= useFree;

      // update sender balances
      const { error: senderErr } = await supabase
        .from("user_profiles")
        .update({
          paid_coin_balance: paid,
          free_coin_balance: free,
        })
        .eq("id", profile.id);

      if (senderErr) throw senderErr;

      // fetch receiver
      const { data: receiverRow, error: recvErr } = await supabase
        .from("user_profiles")
        .select("id, paid_coin_balance, total_earned_coins")
        .eq("id", post.user_id)
        .single();

      if (recvErr) throw recvErr;

      const receiverPaid =
        Number(receiverRow.paid_coin_balance || 0) + GIFT_COST;
      const receiverEarned =
        Number(receiverRow.total_earned_coins || 0) + GIFT_COST;

      const { error: recvUpdateErr } = await supabase
        .from("user_profiles")
        .update({
          paid_coin_balance: receiverPaid,
          total_earned_coins: receiverEarned,
        })
        .eq("id", post.user_id);

      if (recvUpdateErr) throw recvUpdateErr;

      // record gift on post
      const { error: giftErr } = await supabase
        .from("troll_post_gifts")
        .insert({
          post_id: post.id,
          sender_id: profile.id,
          receiver_id: post.user_id,
          gift_name: "Troll Heart",
          coin_cost: GIFT_COST,
        });

      if (giftErr) throw giftErr;

      // update post coin total
      const { error: postErr } = await supabase
        .from("troll_posts")
        .update({
          coins_earned: (post.coins_earned || 0) + GIFT_COST,
        })
        .eq("id", post.id);

      if (postErr) throw postErr;

      // notify receiver
      try {
        await supabase.from("notifications").insert([
          {
            user_id: post.user_id,
            type: "post_gift",
            title: "🎁 New Post Gift",
            message: `${profile.username} sent you a Troll Heart on your post (+${GIFT_COST} coins)`,
            read: false,
            created_at: new Date().toISOString(),
            metadata: {
              post_id: post.id,
              coin_value: GIFT_COST,
            },
          },
        ]);
      } catch (e) {
        console.warn("Notification failed:", e);
      }

      // update local profile so UI shows new balance
      useAuthStore
        .getState()
        .setProfile({
          ...(profile as any),
          paid_coin_balance: paid,
          free_coin_balance: free,
        } as any);

      // optimistic UI update for post coins
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, coins_earned: (p.coins_earned || 0) + GIFT_COST }
            : p
        )
      );

      toast.success("Sent Troll Heart 💜");
    } catch (err) {
      console.error("Error sending post gift:", err);
      toast.error("Failed to send gift");
    }
  };

  const sendReaction = async (post: TrollPost, type: string, cost: number) => {
    if (!user || !profile) return toast.error("Login required");

    if (cost > 0) {
      const totalCoins =
        (profile?.paid_coin_balance || 0) +
        (profile?.free_coin_balance || 0);

      if (totalCoins < cost) {
        toast.error("Not enough coins");
        return;
      }
    }

    try {
      // record reaction
      await supabase.from("troll_post_reactions").insert({
        post_id: post.id,
        user_id: profile.id,
        reaction_type: type,
        coin_cost: cost,
      });

      if (cost > 0) {
        const newPaid = Math.max(0, (profile?.paid_coin_balance || 0) - cost);
        const newFree = Math.max(0, (profile?.free_coin_balance || 0) - (cost - (profile?.paid_coin_balance || 0)));
        await supabase.from("user_profiles").update({
          paid_coin_balance: newPaid,
          free_coin_balance: newFree,
        }).eq("id", profile.id);
        useAuthStore.getState().setProfile({ ...profile, paid_coin_balance: newPaid, free_coin_balance: newFree });
      }

      toast.success(`💥 Reaction sent: ${type}`);
    } catch (err) {
      toast.error("Failed to react");
    }
  };

  return (
    <>
      <style>{`
        .reaction-overlay {
          position: absolute;
          top: 10px;
          right: 10px;
          font-size: 24px;
          pointer-events: none;
          z-index: 10;
        }
        .animate-crown { animation: bounce 1s infinite; }
        .animate-fire { animation: flicker 1.2s infinite; }
        .animate-troll { animation: wiggle 0.6s infinite; }
        .animate-warp { animation: swirl 1.5s infinite; }
        .animate-flex { animation: pulse 2s infinite; }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }

        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-5deg); }
          75% { transform: rotate(5deg); }
        }

        @keyframes swirl {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.2); }
          100% { transform: rotate(360deg) scale(1); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-b from-[#05010B] via-[#090018] to-[#000000] text-white">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold mb-2">Troll City Wall</h1>

        {/* Create Post */}
        <div className="bg-black/60 border border-purple-700/60 rounded-xl p-4 space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share something with Troll City..."
            className="w-full bg-[#05010B] border border-purple-700/60 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-troll-green"
            rows={3}
          />
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="w-full bg-[#05010B] border border-purple-700/60 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-troll-green"
          />
          <button
            disabled={creating}
            onClick={createPost}
            className="px-4 py-2 rounded-full bg-troll-green text-black font-semibold text-sm disabled:opacity-60"
          >
            {creating ? "Posting..." : "Post to Wall"}
          </button>
        </div>

        {/* Feed */}
        {loading && (
          <div className="text-center text-gray-400 text-sm mt-6">
            Loading Troll City…
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-6">
            No posts yet. Be the first citizen to speak 👹
          </div>
        )}

        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-black/60 border border-purple-800/50 rounded-xl p-4 space-y-2"
            >
              <div className="flex items-center space-x-3 text-sm">
                <img
                  src={
                    post.user_profiles?.[0]?.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.user_profiles?.[0]?.username || "troll"}`
                  }
                  alt={post.user_profiles?.[0]?.username || "user"}
                  className="w-8 h-8 rounded-full border border-troll-gold/50"
                />
                <div>
                  <ClickableUsername
                    username={post.user_profiles?.[0]?.username || "Unknown"}
                    className="font-semibold text-sm"
                  />
                  <div className="text-[11px] text-gray-400">
                    {new Date(post.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              {post.reactions?.map((r) => (
                <div key={r.id} className={`reaction-overlay animate-${r.reaction_type}`}>
                  {r.reaction_type === 'crown' && "👑"}
                  {r.reaction_type === 'fire' && "🔥🔥🔥"}
                  {r.reaction_type === 'troll' && "🧌🧌🧌"}
                  {r.reaction_type === 'warp' && "🌪️🌪️"}
                  {r.reaction_type === 'flex' && "💎💎💎"}
                </div>
              ))}

              {post.content && (
                <p className="text-sm mt-1 whitespace-pre-wrap">
                  {post.content}
                </p>
              )}

              {post.image_url && (
                <div className="mt-2 rounded-lg overflow-hidden border border-purple-700/60">
                  <img
                    src={post.image_url}
                    alt="Post"
                    className="w-full max-h-80 object-cover"
                  />
                </div>
              )}

              <div className="flex items-center justify-between mt-2 text-xs text-gray-300">
                <span>{post.coins_earned || 0} coins earned</span>
                <button
                  onClick={() => sendPostGift(post)}
                  className="px-3 py-1 rounded-full bg-troll-purple text-white text-xs flex items-center gap-1"
                >
                  <span>🎁</span>
                  <span>Send Troll Heart ({GIFT_COST})</span>
                </button>
              </div>

              <div className="flex items-center gap-2 mt-3">
                {[
                  { icon: "💚", type: "hug", cost: 0 },
                  { icon: "👑", type: "crown", cost: 100 },
                  { icon: "🔥", type: "fire", cost: 200 },
                  { icon: "🧌", type: "troll", cost: 500 },
                  { icon: "🌪️", type: "warp", cost: 1000 },
                  { icon: "💎", type: "flex", cost: 5000 },
                ].map((r) => (
                  <button
                    key={r.type}
                    onClick={() => sendReaction(post, r.type, r.cost)}
                    className="px-2 py-1 bg-black/60 border border-purple-500 rounded-full text-xs hover:bg-purple-700 transition"
                  >
                    {r.icon} {r.cost > 0 ? r.cost : ""}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
};

export default TrollCityWall;