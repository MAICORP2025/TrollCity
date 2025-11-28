import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { sendNotification } from "../../../lib/sendNotification";
import { toast } from "sonner";

const AdminApplications: React.FC = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const loadApplications = async () => {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load applications");
      return;
    }

    setApplications(data || []);
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const approveApplication = async (app: any) => {
    try {
      await supabase.from("applications").update({
        status: "approved",
        admin_notes: adminNote,
        reviewed_at: new Date().toISOString(),
      }).eq("id", app.id);

      await supabase.from("user_profiles").update({
        role: app.role_requested,
      }).eq("id", app.user_id);

      await sendNotification(
        app.user_id,
        "role_update",
        "🎉 Application Approved",
        `Your application for ${app.role_requested.toUpperCase()} has been approved!`
      );

      toast.success("Application approved and user role updated");
      loadApplications();
      setExpandedId(null);
    } catch {
      toast.error("Error approving application");
    }
  };

  const rejectApplication = async (app: any) => {
    try {
      await supabase.from("applications").update({
        status: "rejected",
        admin_notes: adminNote,
        reviewed_at: new Date().toISOString(),
      }).eq("id", app.id);

      await sendNotification(
        app.user_id,
        "application_result",
        "❌ Application Update",
        `Your application has been reviewed and was not approved at this time.`
      );

      toast.success("Application rejected");
      loadApplications();
      setExpandedId(null);
    } catch {
      toast.error("Error rejecting application");
    }
  };

  return (
    <div className="p-4 text-white">
      <h2 className="text-xl font-semibold mb-4">User Applications</h2>

      {applications.map((app) => (
        <div
          key={app.id}
          className="bg-gray-800 shadow rounded-lg mb-3 border border-gray-700"
        >
          <div
            className="p-4 flex justify-between cursor-pointer"
            onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
          >
            <div>
              <p><strong>@{app.username}</strong></p>
              <p className="text-xs text-gray-400">Requested: {app.role_requested}</p>
              <p className="text-xs text-yellow-400">
                Status: {app.status.toUpperCase()}
              </p>
            </div>
            <p className="text-xs text-gray-400">{new Date(app.created_at).toLocaleString()}</p>
          </div>

          {expandedId === app.id && (
            <div className="bg-gray-900 p-4 border-t border-gray-700 text-sm">
              <p><strong>Experience:</strong></p>
              <p className="mb-2">{app.experience || "Not provided"}</p>

              <p><strong>Why they Applied:</strong></p>
              <p className="mb-2">{app.reason || "Not provided"}</p>

              {app.details && (
                <>
                  <p><strong>Extra Details:</strong></p>
                  <pre className="bg-black p-2 rounded text-xs max-h-40 overflow-auto">
                    {JSON.stringify(app.details, null, 2)}
                  </pre>
                </>
              )}

              <textarea
                className="w-full bg-gray-800 text-white p-2 rounded mt-3 text-sm border border-purple-600"
                rows={3}
                placeholder="Admin notes (visible only to you)"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />

              <div className="flex justify-between mt-3">
                <button
                  onClick={() => approveApplication(app)}
                  className="bg-green-500 px-3 py-1 rounded text-xs"
                >
                  Approve & Assign Role
                </button>
                <button
                  onClick={() => rejectApplication(app)}
                  className="bg-red-500 px-3 py-1 rounded text-xs"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminApplications;