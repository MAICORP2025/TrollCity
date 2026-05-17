import React, { useState } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";

interface ReceiptUploadModalProps {
  request: any;
  onClose: () => void;
  onUploaded: () => void;
}

const ReceiptUploadModal: React.FC<ReceiptUploadModalProps> = ({
  request,
  onClose,
  onUploaded,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return toast.error("Upload receipt before confirming.");

    try {
      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const filePath = `receipt_${request.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payout_receipts")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("payout_receipts")
        .getPublicUrl(filePath);

      const receiptUrl = data.publicUrl;

      await supabase
        .from("payout_requests")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          receipt_url: receiptUrl,
        })
        .eq("id", request.id);

      await supabase.from("notifications").insert([
        {
          user_id: request.user_id,
          type: "payout",
          content: `🎉 Your payout of $${request.cash_value} was approved!\n📎 Receipt included in your Wallet > Payout History\nYou can now withdraw or store it.`,
          metadata: { receipt_url: receiptUrl },
        },
      ]);

      toast.success("Payout approved and receipt uploaded!");
      onUploaded();
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="p-4 bg-gray-900 text-white rounded-md shadow-lg max-w-sm mx-auto">
        <h3 className="font-semibold mb-3">Upload Payment Receipt</h3>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="w-full p-2 bg-gray-800 rounded mb-4"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <button
          disabled={uploading}
          onClick={handleUpload}
          className="w-full bg-green-500 py-2 rounded font-semibold"
        >
          {uploading ? "Uploading..." : "Confirm & Upload"}
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2 bg-gray-700 py-2 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ReceiptUploadModal;