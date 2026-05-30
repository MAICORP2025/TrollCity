import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import { 
  ArrowLeft, BarChart3, Check, CheckCircle2, Clock, Eye, FileText, Gavel, Package, Settings, Users, X
} from 'lucide-react';

interface AuctionApplication {
  id: string;
  user_id: string;
  display_name: string;
  application_text: string;
  selling_plan: string | null;
  experience: string | null;
  agreement_accepted: boolean;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  applicant?: {
    username: string;
    avatar_url: string;
    troll_coins: number;
  };
  reviewer?: {
    username: string;
  };
}

export default function AdminAuctionApps() {
  const _user = useAuthStore();
  const [applications, setApplications] = useState<AuctionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [selectedApp, setSelectedApp] = useState<AuctionApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('auctioneer_applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const reviewApplication = async (applicationId: string, approve: boolean) => {
    if (approve && !adminNotes.trim()) {
      toast.error('Please provide notes when approving');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('review_auctioneer_application', {
        p_application_id: applicationId,
        p_approve: approve,
        p_admin_notes: adminNotes || null
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(approve ? 'Application approved!' : 'Application rejected');
      setSelectedApp(null);
      setAdminNotes('');
      fetchApplications();
    } catch (error: any) {
      toast.error(error.message || 'Failed to review application');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: any }> = {
      pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
      approved: { bg: 'bg-green-500/20', text: 'text-green-400', icon: Check },
      rejected: { bg: 'bg-red-500/20', text: 'text-red-400', icon: X }
    };
    return styles[status] || styles.pending;
  };

  const filteredApps = applications.filter(a => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  const navigate = useNavigate();

  const navItems = [
    { label: 'My Shows', icon: Gavel, route: '/auctions/studio' },
    { label: 'Inventory', icon: Package, route: '/auctions/inventory' },
    { label: 'Bidders', icon: Users, route: '/auctions/bidders' },
    { label: 'Sales', icon: CheckCircle2, route: '/auctions/sales' },
    { label: 'Analytics', icon: BarChart3, route: '/auctions/analytics' },
    { label: 'Settings', icon: Settings, route: '/auctions/settings' },
  ];

  return (
    <div className="bg-gradient-to-br from-[#0A0814] via-[#0D0D1A] to-[#14061A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Nav bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => navigate('/auctions/studio')}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-200 transition hover:bg-purple-500/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Studio
          </button>
          <div className="flex flex-wrap items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => navigate(item.route)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-900/60 px-2.5 py-1.5 text-[11px] font-bold text-gray-400 transition hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-purple-200"
                >
                  <Icon className="h-3 w-3" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
            <FileText className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Auction Applications</h1>
            <p className="text-gray-400">Review and approve auctioneer applications</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {['pending', 'approved', 'rejected'].map((status) => {
            const count = applications.filter(a => a.status === status).length;
            const style = getStatusBadge(status);
            return (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`p-4 border rounded-xl text-left transition-all ${
                  filter === status 
                    ? 'border-purple-500/50 bg-purple-500/10' 
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}
              >
                <div className={`flex items-center gap-2 ${style.text} mb-1`}>
                  <style.icon className="w-4 h-4" />
                  <span className="text-sm capitalize">{status}</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
              </button>
            );
          })}
        </div>

        {/* Applications List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">Loading applications...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/50 rounded-2xl border border-gray-800">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 mb-2">No Applications</h3>
            <p className="text-gray-500">
              {filter === 'all' ? 'No auctioneer applications at this time' : `No ${filter} applications`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApps.map((app) => {
              const style = getStatusBadge(app.status);
              return (
                <div
                  key={app.id}
                  className="p-4 bg-gray-900/50 border border-gray-800 hover:border-purple-500/30 rounded-xl transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1 ${style.bg} ${style.text}`}>
                          <style.icon className="w-3 h-3" />
                          {app.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <p className="text-white font-bold mb-1">{app.display_name}</p>
                      <p className="text-gray-400 text-sm mb-2 line-clamp-2">{app.application_text}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {app.selling_plan && (
                          <span className="truncate max-w-xs">Plan: {app.selling_plan}</span>
                        )}
                        {app.experience && (
                          <span className="truncate max-w-xs">Exp: {app.experience}</span>
                        )}
                      </div>
                    </div>

                    {app.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSelectedApp(app); setAdminNotes(''); }}
                          className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
                          title="Review"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Review Modal */}
        {selectedApp && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-gray-800">
                <h2 className="text-xl font-bold">Review Application</h2>
                <button onClick={() => setSelectedApp(null)} className="p-2 hover:bg-gray-800 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Display Name</label>
                  <p className="text-white font-medium">{selectedApp.display_name}</p>
                </div>
                
                <div>
                  <label className="text-sm text-gray-400">Application Text</label>
                  <p className="text-gray-300 whitespace-pre-wrap">{selectedApp.application_text}</p>
                </div>

                {selectedApp.selling_plan && (
                  <div>
                    <label className="text-sm text-gray-400">Selling Plan</label>
                    <p className="text-gray-300">{selectedApp.selling_plan}</p>
                  </div>
                )}

                {selectedApp.experience && (
                  <div>
                    <label className="text-sm text-gray-400">Experience</label>
                    <p className="text-gray-300">{selectedApp.experience}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm text-gray-400">Admin Notes {selectedApp.status === 'pending' ? '*' : ''}</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows={3}
                    placeholder="Notes about this application..."
                    className="w-full mt-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-800">
                <button
                  onClick={() => reviewApplication(selectedApp.id, false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => reviewApplication(selectedApp.id, true)}
                  disabled={submitting}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}