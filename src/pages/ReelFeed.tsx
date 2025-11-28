import React, { useEffect, useState } from "react";
import { useSwipeable } from "react-swipeable";
import ReelSlide from "./ReelSlide";
import { supabase } from "../lib/supabase";

const ReelFeed: React.FC = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadReels();
  }, []);

  const loadReels = async () => {
    const { data } = await supabase
      .from("troll_posts")
      .select(`
        *,
        user_profiles(*),
        troll_post_gifts(*)
      `)
      .eq("media_type", "video")
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
            i === currentIndex
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <ReelSlide post={post} isActive={i === currentIndex} />
        </div>
      ))}
    </div>
  );
};

export default ReelFeed;