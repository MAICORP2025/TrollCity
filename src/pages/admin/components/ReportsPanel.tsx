import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

interface Report {
  id: string;
  stream_id: string;
  reason: string;
  status: string;
  created_at: string;
  actor_role?: string;
  target_user_id?: string;
}

interface ChatMessage {
  id: string;
  username: string;
  content: string;
  created_at: string;
  stream_id?: string;
}

interface Arrest {
  id: string;
  username: string;
  reason: string;
  stream_id?: string;
  created_at: string;
  expires_at?: string;
  status: string;
}

const ReportsPanel = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [chatLogs, setChatLogs] = useState<ChatMessage[]>([]);
  const [arrests, setArrests] = useState<Arrest[]>([]);

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('broadcast_mod_actions')
        .select('id, stream_id, reason, status, created_at, actor_role, target_user_id')
        .eq('action_type', 'report')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error("Error loading reports:", err);
    }
  };

  const loadChatLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('stream_messages')
        .select('id, content, created_at, stream_id, sender:user_profiles(username)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const mapped = (data || []).map((msg: any) => ({
        id: msg.id,
        username: msg.sender?.username || 'Unknown',
        content: msg.content,
        created_at: msg.created_at,
        stream_id: msg.stream_id,
      }));
      setChatLogs(mapped);
    } catch (err) {
      console.error("Error loading chat logs:", err);
    }
  };

  const loadArrests = async () => {
    try {
      const { data, error } = await supabase
        .from('broadcast_mod_actions')
        .select('id, stream_id, reason, status, created_at, expires_at, target_user_id')
        .eq('action_type', 'arrest')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      
      const userIds = [...new Set((data || []).map((a: any) => a.target_user_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, username')
        .in('id', userIds);
      const userMap = new Map((profiles || []).map((p: any) => [p.id, p.username]));
      
      const mapped = (data || []).map((a: any) => ({
        id: a.id,
        username: userMap.get(a.target_user_id) || 'Unknown',
        reason: a.reason,
        stream_id: a.stream_id,
        created_at: a.created_at,
        expires_at: a.expires_at,
        status: a.status,
      }));
      setArrests(mapped);
    } catch (err) {
      console.error("Error loading arrests:", err);
    }
  };

  useEffect(() => {
    loadReports();
    loadChatLogs();
    loadArrests();

    const reportsInterval = setInterval(loadReports, 30000);
    const chatInterval = setInterval(loadChatLogs, 15000);
    const arrestsInterval = setInterval(loadArrests, 60000);

    return () => {
      clearInterval(reportsInterval);
      clearInterval(chatInterval);
      clearInterval(arrestsInterval);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Abuse Reports</h3>
        <div className="bg-black/40 rounded p-3 max-h-64 overflow-auto">
          {reports.length === 0 ? (
            <p className="text-gray-500">No reports found.</p>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="border-b border-gray-700 py-2">
                <p>Stream: {report.stream_id}</p>
                <p>Reason: {report.reason}</p>
                <p>Status: {report.status}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Chat Logs</h3>
        <div className="bg-black/40 rounded p-3 max-h-64 overflow-auto">
          {chatLogs.length === 0 ? (
            <p className="text-gray-500">No chat logs found.</p>
          ) : (
            chatLogs.map((msg) => (
              <div key={msg.id} className="border-b border-gray-700 py-1">
                <p><strong>{msg.username}:</strong> {msg.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Arrests</h3>
        <div className="bg-black/40 rounded p-3 max-h-64 overflow-auto">
          {arrests.length === 0 ? (
            <p className="text-gray-500">No arrests found.</p>
          ) : (
            arrests.map((user) => (
              <div key={user.id} className="border-b border-gray-700 py-2">
                <p>@{user.username} - {user.reason || 'No reason'}</p>
                <p className="text-xs text-gray-400">Status: {user.status} | Created: {new Date(user.created_at).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPanel;