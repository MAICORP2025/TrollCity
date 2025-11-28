import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { sendNotification } from "../../../lib/sendNotification";
import { toast } from "sonner";

const AdminSupportTickets: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<{ id: string; message: string } | null>(null);

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load tickets");
      return;
    }
    setTickets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();

    const channel = supabase
      .channel("admin-support-tickets")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        () => loadTickets()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendResponse = async (ticketId: string, userId: string) => {
    try {
      await supabase
        .from("support_tickets")
        .update({
          admin_response: responding?.message,
          admin_id: "admin", // Replace with real admin ID
          response_at: new Date().toISOString(),
          status: "resolved",
        })
        .eq("id", ticketId);

      await sendNotification(
        userId,
        "support_reply",
        "Support Ticket Reply",
        `Admin replied to your support ticket: "${responding?.message.slice(0, 80)}..."`,
        { ticketId }
      );

      toast.success("Response sent to user");
      setResponding(null);
      loadTickets();
    } catch {
      toast.error("Failed to send response");
    }
  };

  return (
    <div className="p-4 text-white max-w-5xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Support Tickets</h2>

      {tickets.map((t) => (
        <div
          key={t.id}
          className="bg-gray-800 p-4 rounded-lg shadow mb-4 border border-gray-700"
        >
          <p className="text-sm text-gray-300">
            From: <span className="text-purple-400">@{t.username}</span>
          </p>
          <p className="text-xs text-gray-400">{t.email}</p>
          <p className="text-xs mt-1">
            Category: <strong>{t.category}</strong>
          </p>
          <h3 className="font-semibold mt-2">{t.subject}</h3>
          <p className="bg-gray-900 p-2 rounded text-sm mt-1">{t.message}</p>
          <p className="text-xs text-yellow-400 mt-1">Status: {t.status}</p>

          {!t.admin_response && (
            <button
              onClick={() =>
                setResponding({ id: t.id, message: "" })
              }
              className="mt-3 bg-purple-600 px-3 py-1 rounded text-xs"
            >
              Reply to Ticket
            </button>
          )}

          {responding?.id === t.id && (
            <div className="mt-3">
              <textarea
                value={responding.message}
                onChange={(e) =>
                  setResponding({ ...responding, message: e.target.value })
                }
                className="w-full bg-gray-900 p-2 text-sm rounded border border-gray-700"
                rows={4}
                placeholder="Write your response here..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => sendResponse(t.id, t.user_id)}
                  className="bg-green-500 px-3 py-1 rounded text-xs"
                >
                  Send Response
                </button>
                <button
                  onClick={() => setResponding(null)}
                  className="bg-gray-700 px-3 py-1 rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {t.admin_response && (
            <div className="mt-3 bg-gray-900 p-3 rounded-lg">
              <p className="text-sm text-green-400">Admin Reply:</p>
              <p className="text-xs">{t.admin_response}</p>
            </div>
          )}
        </div>
      ))}

      {loading && (
        <p className="text-center mt-10 text-gray-400">Loading tickets...</p>
      )}
    </div>
  );
};

export default AdminSupportTickets;