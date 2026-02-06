import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { toast } from "sonner";
import UserActions from "./UserActions";
import UserNameWithAge from "../../../components/UserNameWithAge";

interface UsersPanelProps {
  title?: string;
  description?: string;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  is_banned: boolean;
  role: string;
  created_at?: string;
  glowing_username_color?: string;
  rgb_username_expires_at?: string;
  is_gold?: boolean;
  username_style?: string;
  badge?: string;
}

const UsersPanel: React.FC<UsersPanelProps> = ({ title = "User Management", description }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: responseData, error: queryError } = await supabase.functions.invoke('admin-actions', {
        body: {
            action: 'get_users',
            limit: 100
        }
      });
      
      if (queryError) {
        console.error('Error loading users:', queryError);
        setError(`Failed to load users: ${queryError.message}`);
        toast.error(`Failed to load users: ${queryError.message}`);
        setUsers([]);
        return;
      }
      
      const usersData = responseData?.data || [];
      console.log('Loaded users:', usersData.length);
      setUsers(usersData);
    } catch (err: any) {
      console.error('Exception loading users:', err);
      setError(`Error: ${err?.message || 'Unknown error'}`);
      toast.error(`Failed to load users: ${err?.message || 'Unknown error'}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();

    const interval = setInterval(() => {
      loadUsers();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadUsers]);

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-3">{title}</h2>
        {description && <p className="text-sm text-gray-400 mb-3">{description}</p>}
        <div className="bg-black/40 rounded-lg p-4">
          <div className="text-center py-8 text-gray-400">Loading users...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-3">{title}</h2>
        {description && <p className="text-sm text-gray-400 mb-3">{description}</p>}
        <div className="bg-black/40 rounded-lg p-4">
          <div className="text-center py-8">
            <div className="text-red-400 mb-2">{error}</div>
            <button 
              onClick={loadUsers}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-1 mb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          {description && <p className="text-sm text-gray-400">{description}</p>}
        </div>
        <button 
          onClick={loadUsers}
          className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
        >
          Refresh
        </button>
      </div>
      <div className="bg-black/40 rounded-lg p-4">
        {users.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No users found</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex justify-between border-b border-gray-800 py-2">
              <div>
                <div className="text-white flex items-center gap-2">
                  <UserNameWithAge user={u} className="text-white font-medium" />
                  {u.is_banned && <span className="text-red-600 text-xs">(Banned)</span>}
                  {u.role === 'admin' && <span className="text-yellow-400 text-xs">(Admin)</span>}
                </div>
                <p className="text-xs text-gray-500">
                  Created: {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
              <UserActions user={u} refresh={loadUsers} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UsersPanel;
