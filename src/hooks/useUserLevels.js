// src/hooks/useUserLevels.js
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useUserLevels() {
  const [levels, setLevels] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription;

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        setLevels(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        // Map user_stats to expected structure
        setLevels({
            ...data,
            buyer_level: data.level,
            stream_level: data.level, // Unifying levels
            xp: data.xp_total
        });
      }
      setLoading(false);

      // Realtime subscription
      subscription = supabase
        .channel(`user_stats_${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "user_stats", filter: `user_id=eq.${userId}` },
          (payload) => {
            const newData = payload.new;
            setLevels((prev) => ({
              ...(prev || {}),
              ...newData,
              buyer_level: newData.level,
              stream_level: newData.level,
              xp: newData.xp_total
            }));
          }
        )
        .subscribe();
    };

    load();

    return () => {
      if (subscription) supabase.removeChannel(subscription);
    };
  }, []);

  return { levels, loading };
}