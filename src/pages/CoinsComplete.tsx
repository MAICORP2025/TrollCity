import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function CoinsComplete() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    "pending"
  );
  const [message, setMessage] = useState<string>("Finishing your purchase...");

  useEffect(() => {
    const canceled = search.get("canceled");
    const success = search.get("success");

    if (canceled) {
      setStatus("error");
      setMessage("Payment was cancelled.");
      toast.info("Payment cancelled");
      return;
    }

    if (success) {
      setStatus("success");
      setMessage("Payment successful. Your wallet will update shortly.");
      toast.success("Payment successful!");
      return;
    }

    setStatus("pending");
    setMessage("Waiting for payment confirmation...");
  }, [search]);

  return (
    <div className="p-6 max-w-xl mx-auto text-center text-white min-h-screen flex items-center justify-center">
      <div className="bg-[#1A1A1A] border-2 border-purple-500/30 rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-3">Coin Purchase</h1>
        <p className="mb-6">{message}</p>
        {status === "pending" && (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
        )}
        {status !== "pending" && (
          <button
            onClick={() => navigate("/coins")}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors"
          >
            {status === "success" ? "Back to Store" : "Try Again"}
          </button>
        )}
      </div>
    </div>
  );
}
