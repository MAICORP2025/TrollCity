import React from 'react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';

interface UserActionsProps {
  user: {
    id: string;
    username: string;
    email: string;
    is_banned: boolean;
    role: string;
  };
  refresh: () => void;
}

const UserActions: React.FC<UserActionsProps> = ({ user, refresh }) => {
  const banUser = async () => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'ban_user_action',
          userId: user.id,
          until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      });
      if (error) throw error;
      toast.success('User banned');
      refresh();
    } catch {
      toast.error('Failed to ban user');
    }
  };

  const unbanUser = async () => {
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'unban_user_action',
          userId: user.id
        }
      });
      if (error) throw error;
      toast.success('User unbanned');
      refresh();
    } catch {
      toast.error('Failed to unban user');
    }
  };

  const deleteUser = async () => {
    if (!confirm(`Delete user @${user.username}? This action cannot be undone.`)) return;
    try {
      const { error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'soft_delete_user',
          userId: user.id,
          reason: 'Admin deleted via dashboard'
        }
      });
      
      if (error) throw error;
      
      toast.success(`User @${user.username} deleted`);
      refresh();
    } catch (err) {
      toast.error(`Failed to delete user: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="flex gap-2">
      {user.is_banned ? (
        <button
          onClick={unbanUser}
          className="px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-500"
        >
          Unban
        </button>
      ) : (
        <button
          onClick={banUser}
          className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-500"
        >
          Ban
        </button>
      )}
      <button
        onClick={deleteUser}
        className="px-2 py-1 text-xs rounded bg-red-700 hover:bg-red-600"
      >
        Delete
      </button>
    </div>
  );
};

export default UserActions;