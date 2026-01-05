import React, { useEffect, useState } from "react";
import { useSwipeable } from "react-swipeable";
import ReelSlide from "./ReelSlide";
import { supabase } from "../lib/supabase";

const ReelFeed: React.FC = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadReels();
    const channel = supabase
      .channel("treeds-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "troll_posts" },
        (payload) => {
          const newPost = payload.new as any;
          setPosts((prev) => [newPost, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadReels = async () => {
    const { data } = await supabase
      .from("troll_posts")
      .select(
        `
        *,
        user_profiles(*)
      `
      )
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts(data || []);
  };

  const handlers = useSwipeable({
    onSwipedUp: () => nextSlide(),
    onSwipedDown: () => prevSlide(),
    trackMouse: true,
  });

  const nextSlide = () =>
    setCurrentIndex((prev) => (prev < posts.length - 1 ? prev + 1 : prev));

  const prevSlide = () =>
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));

  return (
    <div {...handlers} className="h-screen w-screen overflow-hidden bg-black relative">
      {posts.map((post, i) => (
        <div
          key={post.id}
          className={`absolute inset-0 transition-all duration-500 ${
            i === currentIndex ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {post.media_type === "video" ? (
            <ReelSlide post={post} isActive={i === currentIndex} />
          ) : post.media_type === "image" ? (
            <div className="relative h-full w-full flex items-center justify-center bg-black">
              <img
                src={post.image_url}
                alt={post.user_profiles?.username || "image"}
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute left-3 bottom-10 text-xs text-white max-w-[60%] space-y-1">
                <div className="font-semibold text-sm">@{post.user_profiles?.username}</div>
                {post.content && <div className="text-[11px] text-gray-200 line-clamp-3">{post.content}</div>}
                <div className="text-[10px] text-gray-400">
                  {(post.coins_earned || 0)} coins • {new Date(post.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative h-full w-full flex items-center justify-center bg-black">
              <div className="max-w-xl text-white p-6">
                <div className="font-semibold text-sm mb-2">@{post.user_profiles?.username}</div>
                <div className="text-sm whitespace-pre-wrap break-words">{post.content}</div>
                <div className="text-[10px] text-gray-400 mt-3">
                  {(post.coins_earned || 0)} coins • {new Date(post.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ReelFeed;
