import React, { useState, useMemo } from "react";
import { Search, Circle, ChevronRight, AlertTriangle, Shield } from "lucide-react";
import { CSUser } from "../../../hooks/useCustomerServiceUsers";

interface UserSupportSelectorProps {
  users: CSUser[];
  selectedUserId: string | null;
  onSelectUser: (user: CSUser) => void;
}

export default function UserSupportSelector({
  users,
  selectedUserId,
  onSelectUser,
}: UserSupportSelectorProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredUsers = useMemo(() => {
    let result = users;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.display_name && u.display_name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          u.id.slice(0, 8).includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((u) => {
        switch (statusFilter) {
          case "online":
            return u.is_online;
          case "offline":
            return !u.is_online;
          case "banned":
            return u.account_status === "banned";
          case "jailed":
            return u.account_status === "jailed";
          case "issues":
            return u.bug_report_count > 0 || u.support_ticket_count > 0;
          default:
            return true;
        }
      });
    }

    return result;
  }, [users, search, statusFilter]);

  const formatLastSeen = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
          />
        </div>
      </div>

      {/* Status filters */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[
          { id: "all", label: "All" },
          { id: "online", label: "Online" },
          { id: "offline", label: "Offline" },
          { id: "issues", label: "Issues" },
          { id: "banned", label: "Banned" },
          { id: "jailed", label: "Jailed" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
              statusFilter === f.id
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* User list */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
        {filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">No users found</div>
        ) : (
          filteredUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => onSelectUser(u)}
              className={`w-full rounded-xl border p-3 text-left transition-all ${
                selectedUserId === u.id
                  ? "border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_12px_rgba(45,212,191,0.15)]"
                  : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Circle
                    className={`h-2 w-2 shrink-0 ${
                      u.is_online ? "fill-green-400 text-green-400" : "fill-slate-600 text-slate-600"
                    }`}
                  />
                  <span className="text-sm font-semibold text-white truncate">
                    {u.display_name || u.username}
                  </span>
                  {u.account_status === "banned" && (
                    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                      BANNED
                    </span>
                  )}
                  {u.account_status === "jailed" && (
                    <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-400">
                      JAILED
                    </span>
                  )}
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              </div>

              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                <span>@{u.username}</span>
                {u.role && u.role !== "user" && (
                  <span className="rounded bg-purple-500/15 px-1 py-0.5 text-purple-300">
                    {u.role}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex items-center gap-3 text-[10px] text-slate-500">
                <span>{formatLastSeen(u.last_seen_at)}</span>
                {u.current_path && (
                  <span className="truncate max-w-[120px] text-cyan-400/60">
                    📍 {u.current_path}
                  </span>
                )}
                {u.bug_report_count > 0 && (
                  <span className="flex items-center gap-0.5 text-yellow-400">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {u.bug_report_count}
                  </span>
                )}
                {u.support_ticket_count > 0 && (
                  <span className="flex items-center gap-0.5 text-orange-400">
                    <Shield className="h-2.5 w-2.5" />
                    {u.support_ticket_count}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-600 text-center">
        {filteredUsers.length} of {users.length} users
      </div>
    </div>
  );
}
