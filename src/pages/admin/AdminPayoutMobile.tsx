import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { toast } from "sonner";
import ReceiptUploadModal from "./components/ReceiptUploadModal";

interface PayoutRequest {
  id: string;
  user_id: string;
  username: string;
  coins: number;
  cash_value: number;
  status: string;
  created_at: string;
  payout_method: string;
  receipt_url?: string;
}

interface VisaRedemption {
  id: string;
  user_id: string;
  coins_reserved: number;
  usd_amount: number;
  status: "pending" | "approved" | "fulfilled" | "rejected";
  giftcard_code?: string | null;
  created_at: string;
}

const AdminPayoutMobile: React.FC = () => {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReceiptModal, setShowReceiptModal] = useState<PayoutRequest | null>(null);
  const [redemptions, setRedemptions] = useState<VisaRedemption[]>([]);

  const loadRequests = async () => {
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load requests");
      return;
    }

    setRequests(data || []);
    setLoading(false);
  };

  const loadRedemptions = async () => {
    const { data, error } = await supabase
      .from("visa_redemptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load Visa redemptions");
      return;
    }
    setRedemptions((data as any) || []);
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadRequests(), loadRedemptions()]);
    };

    void init();

    const channel = supabase
      .channel("admin-payouts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payout_requests" },
        () => loadRequests()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visa_redemptions" },
        () => loadRedemptions()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleReject = async (req: PayoutRequest) => {
    try {
      await supabase
        .from("payout_requests")
        .update({ status: "rejected" })
        .eq("id", req.id);

      await supabase.from("notifications").insert([
        {
          user_id: req.user_id,
          type: "payout",
          content: `Your payout request was rejected. Please review your details or contact support.`,
        },
      ]);

      toast.success(`Rejected payout for ${req.username}`);
      loadRequests();
    } catch {
      toast.error("Error rejecting payout");
    }
  };

  const approveRedemption = async (r: VisaRedemption) => {
    try {
      const { error } = await supabase.rpc("approve_visa_redemption", { p_redemption_id: r.id });
      if (error) throw error;
      toast.success("Redemption approved");
      loadRedemptions();
    } catch {
      toast.error("Error approving redemption");
    }
  };

  const fulfillRedemption = async (r: VisaRedemption) => {
    const code = window.prompt("Enter gift card code");
    if (!code || code.trim().length < 6) return toast.error("Invalid gift card code");
    try {
      const { error } = await supabase.rpc("fulfill_visa_redemption", {
        p_redemption_id: r.id,
        p_giftcard_code: code.trim(),
      });
      if (error) throw error;
      toast.success("Redemption fulfilled");
      loadRedemptions();
    } catch {
      toast.error("Error fulfilling redemption");
    }
  };

  const rejectRedemption = async (r: VisaRedemption) => {
    const reason = window.prompt("Enter rejection reason (optional)") || null;
    try {
      const { error } = await supabase.rpc("reject_visa_redemption", {
        p_redemption_id: r.id,
        p_reason: reason,
      });
      if (error) throw error;
      toast.success("Redemption rejected");
      loadRedemptions();
    } catch {
      toast.error("Error rejecting redemption");
    }
  };

  if (loading) return <p className="text-center mt-10 text-white">Loading...</p>;

  return (
    <div className="p-4 max-w-md mx-auto text-white">
      <h2 className="text-xl font-semibold mb-4">Payout Requests</h2>

      {requests.map((req) => (
        <div
          key={req.id}
          className="bg-gray-800 rounded-lg p-4 mb-3 shadow border border-gray-700"
        >
          <p className="text-sm">
            <strong>{req.username}</strong> requested{" "}
            <span className="text-green-400">${req.cash_value}</span>
          </p>
          <p className="text-xs text-gray-400">
            Coins: {req.coins.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">Method: {req.payout_method}</p>
          <p
            className={`text-xs font-medium ${
              req.status === "pending"
                ? "text-yellow-400"
                : req.status === "approved"
                ? "text-green-400"
                : req.status === "rejected"
                ? "text-red-400"
                : ""
            }`}
          >
            Status: {req.status.toUpperCase()}
          </p>
          {req.receipt_url && (
            <a
              href={req.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-xs block mt-1"
            >
              View Payment Receipt
            </a>
          )}

          {req.status === "pending" && (
            <div className="flex justify-between mt-3">
              <button
                type="button"
                onClick={() => setShowReceiptModal(req)}
                className="bg-green-500 hover:bg-green-600 text-xs px-3 py-1 rounded"
              >
                Approve & Upload Receipt
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleReject(req)
                }}
                className="bg-red-500 hover:bg-red-600 text-xs px-3 py-1 rounded"
              >
                Reject
              </button>
            </div>
          )}
          </div>
      ))}

      <h2 className="text-xl font-semibold mt-8 mb-4">Visa eGift Redemptions</h2>
      {redemptions.map((r) => (
        <div
          key={r.id}
          className="bg-gray-800 rounded-lg p-4 mb-3 shadow border border-gray-700"
        >
          <p className="text-sm">
            User: <span className="font-mono">{r.user_id}</span>
          </p>
          <p className="text-xs text-gray-400">
            Coins Reserved: {r.coins_reserved.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">
            Amount: ${Number(r.usd_amount || 0).toFixed(2)}
          </p>
          <p
            className={`text-xs font-medium ${
              r.status === "pending"
                ? "text-yellow-400"
                : r.status === "approved"
                ? "text-blue-400"
                : r.status === "fulfilled"
                ? "text-green-400"
                : r.status === "rejected"
                ? "text-red-400"
                : ""
            }`}
          >
            Status: {r.status.toUpperCase()}
          </p>

          {(r.status === "pending" || r.status === "approved") && (
            <div className="flex justify-between mt-3">
              {r.status === "pending" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    approveRedemption(r);
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-xs px-3 py-1 rounded"
                >
                  Approve
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  fulfillRedemption(r);
                }}
                className="bg-purple-500 hover:bg-purple-600 text-xs px-3 py-1 rounded"
              >
                Fulfill
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  rejectRedemption(r);
                }}
                className="bg-red-500 hover:bg-red-600 text-xs px-3 py-1 rounded"
              >
                Reject
              </button>
            </div>
          )}

          {r.status === "fulfilled" && r.giftcard_code && (
            <div className="mt-2 text-xs text-gray-300">
              Code: <span className="font-mono">{r.giftcard_code}</span>
            </div>
          )}
        </div>
      ))}

      {showReceiptModal && (
        <ReceiptUploadModal
          request={showReceiptModal}
          onClose={() => setShowReceiptModal(null)}
          onUploaded={loadRequests}
        />
      )}
    </div>
  );
};

export default AdminPayoutMobile;
