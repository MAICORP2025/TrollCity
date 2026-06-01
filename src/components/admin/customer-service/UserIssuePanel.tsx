import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  Bug,
  Shield,
  FileText,
  Car,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { CSUser } from "../../../hooks/useCustomerServiceUsers";

interface UserIssuePanelProps {
  user: CSUser;
}

interface IssueSection {
  title: string;
  icon: React.ReactNode;
  count: number;
  items: any[];
  defaultOpen: boolean;
}

export default function UserIssuePanel({ user }: UserIssuePanelProps) {
  const [sections, setSections] = useState<IssueSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchIssues = async () => {
      setLoading(true);
      const newSections: IssueSection[] = [];
      const newExpanded: Record<string, boolean> = {};

      // Bug reports
      try {
        const { data: bugs } = await supabase
          .from("app_bug_reports")
          .select("id, error_message, severity, status, created_at, page_url")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (bugs && bugs.length > 0) {
          newSections.push({
            title: "Bug Reports",
            icon: <Bug className="h-4 w-4 text-yellow-400" />,
            count: bugs.length,
            items: bugs,
            defaultOpen: true,
          });
          newExpanded["Bug Reports"] = true;
        }
      } catch {
        // table may not exist
      }

      // Support tickets
      try {
        const { data: tickets } = await supabase
          .from("support_tickets")
          .select("id, subject, status, priority, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (tickets && tickets.length > 0) {
          newSections.push({
            title: "Support Tickets",
            icon: <Shield className="h-4 w-4 text-orange-400" />,
            count: tickets.length,
            items: tickets,
            defaultOpen: true,
          });
          newExpanded["Support Tickets"] = true;
        }
      } catch {
        // table may not exist
      }

      // Jail records
      try {
        const { data: jail } = await supabase
          .from("jail")
          .select("id, reason, severity, release_time, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (jail && jail.length > 0) {
          newSections.push({
            title: "Jail / Restrictions",
            icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
            count: jail.length,
            items: jail,
            defaultOpen: true,
          });
          newExpanded["Jail / Restrictions"] = true;
        }
      } catch {
        // table may not exist
      }

      // Payout requests
      try {
        const { data: payouts } = await supabase
          .from("payout_requests")
          .select("id, amount, status, created_at, flagged_reason")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (payouts && payouts.length > 0) {
          newSections.push({
            title: "Payout Requests",
            icon: <DollarSign className="h-4 w-4 text-green-400" />,
            count: payouts.length,
            items: payouts,
            defaultOpen: false,
          });
        }
      } catch {
        // table may not exist
      }

      // Driver test history
      try {
        const { data: tests } = await supabase
          .from("driver_tests")
          .select("id, score, passed, test_date")
          .eq("user_id", user.id)
          .order("test_date", { ascending: false })
          .limit(5);
        if (tests && tests.length > 0) {
          newSections.push({
            title: "Driver Tests",
            icon: <Car className="h-4 w-4 text-cyan-400" />,
            count: tests.length,
            items: tests,
            defaultOpen: false,
          });
        }
      } catch {
        // table may not exist
      }

      // Recent admin actions (audit log)
      try {
        const { data: adminActions } = await supabase
          .from("customer_service_audit_logs")
          .select("id, action, details, created_at")
          .eq("target_user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (adminActions && adminActions.length > 0) {
          newSections.push({
            title: "CS Audit Trail",
            icon: <FileText className="h-4 w-4 text-purple-400" />,
            count: adminActions.length,
            items: adminActions,
            defaultOpen: false,
          });
        }
      } catch {
        // table may not exist
      }

      setSections(newSections);
      setExpanded(newExpanded);
      setLoading(false);
    };

    fetchIssues();
  }, [user.id]);

  const toggleSection = (title: string) => {
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Shield className="mb-2 h-8 w-8 text-slate-700" />
        <p className="text-sm">No issues found for this user</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <div
          key={section.title}
          className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden"
        >
          <button
            onClick={() => toggleSection(section.title)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              {section.icon}
              <span className="text-sm font-semibold text-white">{section.title}</span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                {section.count}
              </span>
            </div>
            {expanded[section.title] ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </button>

          {expanded[section.title] && (
            <div className="border-t border-white/5 px-4 py-2">
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {section.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-lg bg-white/[0.03] px-3 py-2 text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-medium truncate max-w-[200px]">
                        {item.error_message || item.subject || item.reason || item.action || `ID: ${item.id.slice(0, 8)}`}
                      </span>
                      {item.status && (
                        <span
                          className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            item.status === "open" || item.status === "active"
                              ? "bg-yellow-500/20 text-yellow-300"
                              : item.status === "fixed" || item.status === "completed"
                              ? "bg-green-500/20 text-green-300"
                              : item.status === "flagged"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-slate-500/20 text-slate-400"
                          }`}
                        >
                          {item.status}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(item.created_at).toLocaleString()}
                      {item.page_url && (
                        <span className="flex items-center gap-0.5 text-cyan-400/60">
                          <ExternalLink className="h-2.5 w-2.5" />
                          {item.page_url}
                        </span>
                      )}
                      {item.severity && (
                        <span className="text-orange-400/60">{item.severity}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
