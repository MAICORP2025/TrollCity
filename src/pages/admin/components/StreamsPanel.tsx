// StreamsPanel.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

const StreamsPanel = () => {
  const [streams, setStreams] = useState<any[]>([]);

  const loadStreams = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "get_active_streams_admin" },
      });
      if (error) throw error;
      setStreams(data?.streams || []);
    } catch (err) {
      console.error("Error loading streams:", err);
    }
  };

  const handleForceEnd = async (streamId: string) => {
    try {
      const { error } = await supabase.functions.invoke("admin-actions", {
        body: { action: "admin_force_end_stream", streamId },
      });
      if (error) throw error;
      loadStreams();
    } catch (err) {
      console.error("Error ending stream:", err);
      alert("Failed to end stream");
    }
  };

  useEffect(() => {
    loadStreams();

    const interval = setInterval(() => {
      loadStreams();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Active Live Streams</h2>
      {streams.map((stream) => (
        <div key={stream.id} className="p-3 bg-black/40 rounded-lg mb-3">
          <p className="text-purple-400">{stream.title}</p>
          <p>Streamer: @{stream.broadcaster_id}</p>
          <p>Viewers: {stream.current_viewers || 0}</p>
          <button
            className="bg-red-600 px-3 py-1 mt-2 rounded"
            onClick={() => handleForceEnd(stream.id)}
          >
            Force End
          </button>
        </div>
      ))}
    </div>
  );
};

export default StreamsPanel;