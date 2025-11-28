import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import UserActions from "./UserActions";

const UsersPanel: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from("user_profiles")
      .select("id, username, email, avatar_url, is_verified, is_banned, role, created_at")
      .order("created_at", { ascending: false });
    setUsers(data || []);
  };

  useEffect(() => {
    loadUsers();

    const channel = supabase
      .channel("admin_users")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles" }, loadUsers)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-3">User Management</h2>
      <div className="bg-black/40 rounded-lg p-4">
        {users.map((u) => (
          <div key={u.id} className="flex justify-between border-b border-gray-800 py-2">
            <div>
              <p>@{u.username} {u.is_banned && <span className="text-red-600">(Banned)</span>}</p>
              <p className="text-sm text-gray-400">{u.email}</p>
            </div>
            <UserActions user={u} refresh={loadUsers} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsersPanel;