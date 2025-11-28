import React, { useEffect, useState } from "react";
import api from "../../../lib/api";

const SquarePanel: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);

  const loadEvents = async () => {
    const response = await api.get("/payments/status");
    setEvents(response?.events || []);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Square Payment Activity</h2>
      <pre className="bg-black/50 p-3 rounded">{JSON.stringify(events, null, 2)}</pre>
    </div>
  );
};

export default SquarePanel;