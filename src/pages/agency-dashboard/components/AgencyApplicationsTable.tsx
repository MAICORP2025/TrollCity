import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Loader } from '../../../components/ui/loader';

type AgencyApplicationsTableProps = {
  agencyId?: string;
  currentUserId?: string;
  canManage?: boolean;
};

type AgencyApplicationRow = {
  id: string;
  agency_id: string;
  applicant_id: string;
  message: string | null;
  content_type: string | null;
  live_schedule: string | null;
  battle_interest: boolean | null;
  social_links: Record<string, string> | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  applicant_profile?: {
    username?: string | null;
    avatar_url?: string | null;
  } | null;
};

const statusStyles: Record<string, string> = {
  pending: 'border-yellow-500/50 text-yellow-300',
  approved: 'border-emerald-500/50 text-emerald-300',
  denied: 'border-rose-500/50 text-rose-300',
  withdrawn: 'border-slate-500/50 text-slate-300',
};

export const AgencyApplicationsTable: React.FC<AgencyApplicationsTableProps> = ({
  agencyId,
  currentUserId,
  canManage = false,
}) => {
  const [applications, setApplications] = useState<AgencyApplicationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingApplications = useMemo(
    () => applications.filter((application) => application.status === 'pending'),
    [applications],
  );

  const fetchApplications = async () => {
    if (!agencyId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('agency_applications')
        .select(`*, applicant_profile:user_profiles!agency_applications_applicant_id_fkey(username, avatar_url)`)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setApplications((data as AgencyApplicationRow[]) || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApplications();
  }, [agencyId]);

  const updateApplication = async (applicationId: string, status: 'approved' | 'denied') => {
    if (!currentUserId || !canManage) {
      return;
    }

    try {
      setActionLoading(applicationId);
      const rpcName = status === 'approved' ? 'approve_agency_application' : 'deny_agency_application';
      const { error } = await supabase.rpc(rpcName, {
        p_application_id: applicationId,
        p_actor_id: currentUserId,
        p_reason: `${status === 'approved' ? 'Approved' : 'Denied'} from agency enforcement panel`,
      });

      if (error) {
        throw error;
      }

      await fetchApplications();
    } catch (err: any) {
      setError(err?.message || 'Failed to update application.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatSocialLinks = (links: Record<string, string> | null) => {
    if (!links) {
      return 'None provided';
    }

    return Object.entries(links)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-cyan-400">Agency Applications</h3>
          <p className="text-sm text-slate-400">
            Review incoming creators and approve or deny them with server-side audit logging.
          </p>
        </div>
        <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
          {pendingApplications.length} pending
        </Badge>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader />
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700/60 px-4 py-8 text-center text-slate-400">
          No applications have been submitted yet.
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((application) => {
            const isPending = application.status === 'pending';

            return (
              <div
                key={application.id}
                className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">
                        @{application.applicant_profile?.username || 'unknown'}
                      </span>
                      <Badge
                        variant="outline"
                        className={statusStyles[application.status] || 'border-slate-500/50 text-slate-300'}
                      >
                        {application.status}
                      </Badge>
                    </div>

                    <p className="text-sm text-slate-300">{application.message || 'No message provided.'}</p>
                    <div className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
                      <div>
                        <span className="text-slate-500">Content type:</span>{' '}
                        {application.content_type || 'Not provided'}
                      </div>
                      <div>
                        <span className="text-slate-500">Schedule:</span>{' '}
                        {application.live_schedule || 'Not provided'}
                      </div>
                      <div>
                        <span className="text-slate-500">Battle interest:</span>{' '}
                        {application.battle_interest ? 'Yes' : 'No'}
                      </div>
                      <div>
                        <span className="text-slate-500">Social links:</span>{' '}
                        {formatSocialLinks(application.social_links)}
                      </div>
                    </div>
                  </div>

                  {isPending && canManage ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                        onClick={() => updateApplication(application.id, 'approved')}
                        disabled={actionLoading === application.id}
                      >
                        {actionLoading === application.id ? 'Processing...' : 'Approve'}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
                        onClick={() => updateApplication(application.id, 'denied')}
                        disabled={actionLoading === application.id}
                      >
                        {actionLoading === application.id ? 'Processing...' : 'Deny'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgencyApplicationsTable;