import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Zap, TrendingUp, Lock, Trash2, Power, Film, Loader, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Transaction, PayoutGoal, ContentWithCreator } from '@shared/api';

interface AdminStats {
  total_users: number;
  total_coin_balance: number;
  users: any[];
}

export default function AdminDashboardPage() {
  const { user } = useAuth();

  if (!user || user.role !== 'admin') {
    return (
      <Layout>
        <div className="min-h-screen pt-20 flex items-center justify-center">
          <div className="card-glow rounded-2xl p-12 text-center max-w-md">
            <Lock className="mx-auto text-red-500 mb-4" size={48} />
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-gray-400">
              You do not have permission to access the admin dashboard.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <ProtectedRoute requiredRole="admin">
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

interface CreatorApplication {
  id: string;
  user_id: string;
  legal_name: string;
  creator_name: string;
  dob: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  category: string;
  social_links: any;
  id_file_url_front: string;
  id_file_url_back?: string;
  status: 'pending' | 'approved' | 'denied';
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

function AdminDashboardContent() {
  const { user: _user } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payoutGoals, setPayoutGoals] = useState<PayoutGoal[]>([]);
  const [content, setContent] = useState<ContentWithCreator[]>([]);
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isLoadingPayouts, setIsLoadingPayouts] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantAmount, setGrantAmount] = useState('');
  const [isGranting, setIsGranting] = useState(false);
  const [payoutUserId, setPayoutUserId] = useState('');
  const [payoutGoalAmount, setPayoutGoalAmount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [isSettingPayoutGoal, setIsSettingPayoutGoal] = useState(false);
  const [isProcessingPayouts, setIsProcessingPayouts] = useState(false);
  const [contentFilter, setContentFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [applicationFilter, setApplicationFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending');
  const [selectedApplication, setSelectedApplication] = useState<CreatorApplication | null>(null);
  const [isProcessingApplication, setIsProcessingApplication] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'grant' | 'purchase' | 'spend' | 'payout'>('all');

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    loadPayoutGoals();
  }, []);

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setIsLoadingTransactions(true);
      const response = await fetch('/api/admin/transactions', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const loadPayoutGoals = async () => {
    try {
      setIsLoadingPayouts(true);
      const response = await fetch('/api/admin/payouts/goals', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setPayoutGoals(data.goals || []);
      }
    } catch (error) {
      console.error('Error loading payout goals:', error);
    } finally {
      setIsLoadingPayouts(false);
    }
  };

  const loadContent = async () => {
    try {
      setIsLoadingContent(true);
      const response = await fetch('/api/admin/content', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setContent(data.content || []);
      }
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const loadApplications = async () => {
    try {
      setIsLoadingApplications(true);
      const response = await fetch('/api/admin/creator/applications', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setIsLoadingApplications(false);
    }
  };

  const handleGrantCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUserId || !grantAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsGranting(true);
    try {
      const response = await fetch('/api/admin/grant-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: grantUserId,
          amount: parseInt(grantAmount),
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Granted ${grantAmount} coins successfully`);
        setGrantUserId('');
        setGrantAmount('');
        loadStats();
        loadTransactions();
      } else {
        toast.error(result.error || 'Failed to grant coins');
      }
    } catch {
      toast.error('Error granting coins');
    } finally {
      setIsGranting(false);
    }
  };

  const handleSetPayoutGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutUserId || !payoutGoalAmount || !payoutAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSettingPayoutGoal(true);
    try {
      const response = await fetch('/api/admin/payouts/set-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: payoutUserId,
          coin_goal: parseInt(payoutGoalAmount),
          payout_amount: parseInt(payoutAmount),
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Payout goal set successfully');
        setPayoutUserId('');
        setPayoutGoalAmount('');
        setPayoutAmount('');
        loadPayoutGoals();
      } else {
        toast.error(result.error || 'Failed to set payout goal');
      }
    } catch {
      toast.error('Error setting payout goal');
    } finally {
      setIsSettingPayoutGoal(false);
    }
  };

  const handleTogglePayoutGoal = async (userId: string, currentEnabled: boolean) => {
    try {
      const response = await fetch('/api/admin/payouts/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          user_id: userId,
          enabled: !currentEnabled,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Payout goal ${!currentEnabled ? 'enabled' : 'disabled'}`);
        loadPayoutGoals();
      } else {
        toast.error(result.error || 'Failed to toggle payout goal');
      }
    } catch {
      toast.error('Error toggling payout goal');
    }
  };

  const handleDeletePayoutGoal = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this payout goal?')) return;

    try {
      const response = await fetch(`/api/admin/payouts/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Payout goal deleted successfully');
        loadPayoutGoals();
      } else {
        toast.error(result.error || 'Failed to delete payout goal');
      }
    } catch {
      toast.error('Error deleting payout goal');
    }
  };

  const handleProcessPayouts = async () => {
    setIsProcessingPayouts(true);
    try {
      const response = await fetch('/api/admin/payouts/process', {
        method: 'POST',
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`${result.message || 'Payouts processed'}`);
        loadPayoutGoals();
        loadTransactions();
        loadStats();
      } else {
        toast.error(result.error || 'Failed to process payouts');
      }
    } catch {
      toast.error('Error processing payouts');
    } finally {
      setIsProcessingPayouts(false);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this content permanently?')) return;

    try {
      const response = await fetch('/api/admin/content', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content_id: contentId }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Content deleted successfully');
        loadContent();
      } else {
        toast.error(result.error || 'Failed to delete content');
      }
    } catch {
      toast.error('Error deleting content');
    }
  };

  const handleUpdateContentStatus = async (contentId: string, newStatus: 'approved' | 'rejected' | 'pending') => {
    try {
      const response = await fetch('/api/admin/content/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content_id: contentId, status: newStatus }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Content ${newStatus} successfully`);
        loadContent();
      } else {
        toast.error(result.error || 'Failed to update content status');
      }
    } catch {
      toast.error('Error updating content status');
    }
  };

  const handleRestrictCreator = async (creatorId: string) => {
    if (!confirm('Are you sure you want to restrict this creator?')) return;

    try {
      const response = await fetch('/api/admin/creators/restrict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ creator_id: creatorId }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Creator restricted successfully');
        loadContent();
      } else {
        toast.error(result.error || 'Failed to restrict creator');
      }
    } catch {
      toast.error('Error restricting creator');
    }
  };

  const handleUnrestrictCreator = async (creatorId: string) => {
    try {
      const response = await fetch('/api/admin/creators/unrestrict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ creator_id: creatorId }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Creator unrestricted successfully');
        loadContent();
      } else {
        toast.error(result.error || 'Failed to unrestrict creator');
      }
    } catch {
      toast.error('Error unrestricting creator');
    }
  };

  const handleApproveApplication = async (applicationId: string, creatorName: string, category: string) => {
    setIsProcessingApplication(true);
    try {
      const response = await fetch('/api/admin/creator/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          applicationId,
          creatorName,
          bio: approvalNotes,
          category,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Application approved successfully');
        setSelectedApplication(null);
        setApprovalNotes('');
        loadApplications();
      } else {
        toast.error(result.error || 'Failed to approve application');
      }
    } catch {
      toast.error('Error approving application');
    } finally {
      setIsProcessingApplication(false);
    }
  };

  const handleDenyApplication = async (applicationId: string, notes: string) => {
    setIsProcessingApplication(true);
    try {
      const response = await fetch('/api/admin/creator/deny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          applicationId,
          notes,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Application denied successfully');
        setSelectedApplication(null);
        setApprovalNotes('');
        loadApplications();
      } else {
        toast.error(result.error || 'Failed to deny application');
      }
    } catch {
      toast.error('Error denying application');
    } finally {
      setIsProcessingApplication(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'grant':
        return 'text-yellow-400';
      case 'purchase':
        return 'text-blue-400';
      case 'spend':
        return 'text-red-400';
      case 'payout':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <Layout>
      <section className="section-padding bg-black">
        <div className="container-wide">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400 mb-8">Manage platform users and content</p>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {isLoading ? (
              <>
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
              </>
            ) : (
              <>
                <div className="card-glow rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Users</p>
                      <p className="text-3xl font-bold text-white">
                        {stats?.total_users || 0}
                      </p>
                    </div>
                    <Users className="text-yellow-400" size={32} />
                  </div>
                </div>

                <div className="card-glow rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Coin Balance</p>
                      <p className="text-3xl font-bold text-white">
                        {(stats?.total_coin_balance || 0).toLocaleString()}
                      </p>
                    </div>
                    <Zap className="text-yellow-400" size={32} />
                  </div>
                </div>

                <div className="card-glow rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Avg Balance per User</p>
                      <p className="text-3xl font-bold text-white">
                        {(
                          (stats?.total_coin_balance || 0) / Math.max(stats?.total_users || 1, 1)
                        ).toFixed(0)}
                      </p>
                    </div>
                    <TrendingUp className="text-yellow-400" size={32} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="bg-white/10 border border-white/20 mb-6">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="applications">Applications</TabsTrigger>
              <TabsTrigger value="grant-coins">Grant Coins</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="card-glow rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-6">User List</h2>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-gray-300">
                    <thead className="border-b border-white/10">
                      <tr>
                        <th className="text-left py-3 px-4">Username</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-left py-3 px-4">Role</th>
                        <th className="text-right py-3 px-4">Coin Balance</th>
                        <th className="text-right py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {stats?.users.map((u: any) => (
                        <tr key={u.id} className="hover:bg-white/5 transition">
                          <td className="py-3 px-4 font-semibold text-white">
                            {u.username}
                          </td>
                          <td className="py-3 px-4">{u.email}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded text-xs bg-yellow-400/20 text-yellow-400">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {u.coin_balance.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button className="text-yellow-400 hover:text-yellow-300 text-xs">
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* Applications Tab */}
            <TabsContent value="applications" className="card-glow rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-6">Creator Applications</h2>

              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setApplicationFilter('pending')}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    applicationFilter === 'pending'
                      ? 'bg-yellow-400 text-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <Clock className="inline mr-2" size={16} />
                  Pending
                </button>
                <button
                  onClick={() => setApplicationFilter('approved')}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    applicationFilter === 'approved'
                      ? 'bg-green-500 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <CheckCircle2 className="inline mr-2" size={16} />
                  Approved
                </button>
                <button
                  onClick={() => setApplicationFilter('denied')}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    applicationFilter === 'denied'
                      ? 'bg-red-500 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <XCircle className="inline mr-2" size={16} />
                  Denied
                </button>
                <button
                  onClick={() => setApplicationFilter('all')}
                  className={`px-4 py-2 rounded font-semibold transition ${
                    applicationFilter === 'all'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  All
                </button>
              </div>

              {isLoadingApplications ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded" />
                  ))}
                </div>
              ) : applications.filter((app) => applicationFilter === 'all' || app.status === applicationFilter).length > 0 ? (
                <div className="space-y-4">
                  {applications
                    .filter((app) => applicationFilter === 'all' || app.status === applicationFilter)
                    .map((app) => (
                      <div
                        key={app.id}
                        className="border border-white/10 rounded-lg p-4 hover:bg-white/5 transition cursor-pointer"
                        onClick={() => setSelectedApplication(app)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white">{app.creator_name}</h3>
                            <p className="text-sm text-gray-400">{app.legal_name}</p>
                            <p className="text-sm text-gray-400">{app.email}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              Applied: {formatDate(app.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {app.status === 'pending' && (
                              <Clock className="text-yellow-400" size={24} />
                            )}
                            {app.status === 'approved' && (
                              <CheckCircle2 className="text-green-400" size={24} />
                            )}
                            {app.status === 'denied' && (
                              <XCircle className="text-red-400" size={24} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Clock size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No {applicationFilter !== 'all' ? applicationFilter : ''} applications</p>
                </div>
              )}

              {/* Application Detail Modal */}
              {selectedApplication && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                  <div className="bg-slate-900 rounded-2xl max-w-2xl w-full max-h-screen overflow-y-auto border border-white/10 p-8">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h2 className="text-2xl font-bold text-white">{selectedApplication.creator_name}</h2>
                        <p className="text-gray-400">{selectedApplication.category}</p>
                      </div>
                      <button
                        onClick={() => setSelectedApplication(null)}
                        className="text-gray-400 hover:text-white text-2xl"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-400 text-sm">Legal Name</p>
                          <p className="text-white font-semibold">{selectedApplication.legal_name}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Email</p>
                          <p className="text-white font-semibold">{selectedApplication.email}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Phone</p>
                          <p className="text-white font-semibold">{selectedApplication.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Date of Birth</p>
                          <p className="text-white font-semibold">{selectedApplication.dob}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-gray-400 text-sm">Bio</p>
                        <p className="text-white">{selectedApplication.bio}</p>
                      </div>

                      <div>
                        <p className="text-gray-400 text-sm mb-3">ID Verification</p>
                        <div className="grid md:grid-cols-2 gap-4">
                          {selectedApplication.id_file_url_front && (
                            <div>
                              <p className="text-xs text-gray-400 mb-2">ID Front</p>
                              <a
                                href={`/uploads/id_verification/${selectedApplication.id_file_url_front}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-yellow-400 hover:text-yellow-300 text-sm underline"
                              >
                                View File →
                              </a>
                            </div>
                          )}
                          {selectedApplication.id_file_url_back && (
                            <div>
                              <p className="text-xs text-gray-400 mb-2">ID Back</p>
                              <a
                                href={`/uploads/id_verification/${selectedApplication.id_file_url_back}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-yellow-400 hover:text-yellow-300 text-sm underline"
                              >
                                View File →
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedApplication.status === 'pending' && (
                      <div className="space-y-4 border-t border-white/10 pt-6">
                        <div>
                          <Label htmlFor="approval-notes" className="text-white text-sm">
                            Bio / Additional Notes
                          </Label>
                          <textarea
                            id="approval-notes"
                            value={approvalNotes}
                            onChange={(e) => setApprovalNotes(e.target.value)}
                            placeholder="Add any notes for the creator's profile..."
                            className="w-full mt-2 px-3 py-2 rounded bg-white/10 border border-white/20 text-white placeholder:text-gray-500 text-sm resize-none"
                            rows={3}
                            disabled={isProcessingApplication}
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleApproveApplication(selectedApplication.id, selectedApplication.creator_name, selectedApplication.category)}
                            disabled={isProcessingApplication}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold"
                          >
                            {isProcessingApplication ? (
                              <>
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Approve
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleDenyApplication(selectedApplication.id, approvalNotes)}
                            disabled={isProcessingApplication}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold"
                          >
                            {isProcessingApplication ? (
                              <>
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <XCircle className="mr-2 h-4 w-4" />
                                Deny
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => setSelectedApplication(null)}
                            disabled={isProcessingApplication}
                            variant="outline"
                            className="flex-1"
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedApplication.status === 'approved' && (
                      <div className="border-t border-white/10 pt-6">
                        <div className="flex items-center gap-2 text-green-400 mb-4">
                          <CheckCircle2 className="h-6 w-6" />
                          <span className="font-semibold">Approved on {formatDate(selectedApplication.reviewed_at || '')}</span>
                        </div>
                        {selectedApplication.admin_notes && (
                          <div className="bg-white/5 rounded p-4">
                            <p className="text-gray-400 text-sm">Admin Notes</p>
                            <p className="text-white mt-2">{selectedApplication.admin_notes}</p>
                          </div>
                        )}
                        <Button
                          onClick={() => setSelectedApplication(null)}
                          className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white"
                        >
                          Close
                        </Button>
                      </div>
                    )}

                    {selectedApplication.status === 'denied' && (
                      <div className="border-t border-white/10 pt-6">
                        <div className="flex items-center gap-2 text-red-400 mb-4">
                          <XCircle className="h-6 w-6" />
                          <span className="font-semibold">Denied on {formatDate(selectedApplication.reviewed_at || '')}</span>
                        </div>
                        {selectedApplication.admin_notes && (
                          <div className="bg-white/5 rounded p-4">
                            <p className="text-gray-400 text-sm">Denial Reason</p>
                            <p className="text-white mt-2">{selectedApplication.admin_notes}</p>
                          </div>
                        )}
                        <Button
                          onClick={() => setSelectedApplication(null)}
                          className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white"
                        >
                          Close
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Grant Coins Tab */}
            <TabsContent value="grant-coins" className="card-glow rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-6">Grant Coins to User</h2>

              <form onSubmit={handleGrantCoins} className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="user-id" className="text-white">
                    User ID
                  </Label>
                  <Input
                    id="user-id"
                    type="text"
                    placeholder="Enter user ID"
                    value={grantUserId}
                    onChange={(e) => setGrantUserId(e.target.value)}
                    disabled={isGranting}
                    className="bg-white/10 border-white/20 text-white"
                  />
                  <p className="text-xs text-gray-400">
                    Find user ID from the users list above
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-white">
                    Coin Amount
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    disabled={isGranting}
                    className="bg-white/10 border-white/20 text-white"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isGranting}
                  className="w-full neon-btn-gold text-black font-semibold"
                >
                  {isGranting ? 'Granting...' : 'Grant Coins'}
                </Button>
              </form>
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="card-glow rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-6">Platform Transactions</h2>

              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <Input
                  type="text"
                  placeholder="Search by user ID or description..."
                  value={transactionSearch}
                  onChange={(e) => setTransactionSearch(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                />
                <select
                  value={transactionFilter}
                  onChange={(e) => setTransactionFilter(e.target.value as any)}
                  className="px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
                >
                  <option value="all">All Types</option>
                  <option value="grant">Grants</option>
                  <option value="purchase">Purchases</option>
                  <option value="spend">Spends</option>
                  <option value="payout">Payouts</option>
                </select>
              </div>

              {isLoadingTransactions ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {transactions.length > 0 ? (
                    <table className="w-full text-sm text-gray-300">
                      <thead className="border-b border-white/10">
                        <tr>
                          <th className="text-left py-3 px-4">Date</th>
                          <th className="text-left py-3 px-4">User ID</th>
                          <th className="text-left py-3 px-4">Type</th>
                          <th className="text-right py-3 px-4">Amount</th>
                          <th className="text-left py-3 px-4">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {transactions
                          .filter((tx) =>
                            (transactionFilter === 'all' || tx.type === transactionFilter) &&
                            (transactionSearch === '' ||
                             tx.user_id.toLowerCase().includes(transactionSearch.toLowerCase()) ||
                             (tx.description && tx.description.toLowerCase().includes(transactionSearch.toLowerCase()))
                            )
                          )
                          .map((tx: Transaction) => (
                          <tr key={tx.id} className="hover:bg-white/5 transition">
                            <td className="py-3 px-4 text-gray-400">
                              {formatDate(tx.created_at)}
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-gray-400">
                              {tx.user_id.substring(0, 8)}...
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${getTransactionColor(tx.type)} bg-${tx.type === 'grant' ? 'yellow' : tx.type === 'purchase' ? 'blue' : tx.type === 'spend' ? 'red' : tx.type === 'payout' ? 'green' : 'gray'}-500/20`}>
                                {tx.type.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-yellow-400">
                              +{tx.amount}
                            </td>
                            <td className="py-3 px-4 text-gray-400">
                              {tx.description || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>No transactions yet</p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Payouts Tab */}
            <TabsContent value="payouts" className="card-glow rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-6">Automated Payouts (Mon/Fri)</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Set Payout Goal Form */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Set Payout Goal</h3>
                  <form onSubmit={handleSetPayoutGoal} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="payout-user-id" className="text-white">
                        User ID
                      </Label>
                      <Input
                        id="payout-user-id"
                        type="text"
                        placeholder="Enter user ID"
                        value={payoutUserId}
                        onChange={(e) => setPayoutUserId(e.target.value)}
                        disabled={isSettingPayoutGoal}
                        className="bg-white/10 border-white/20 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="coin-goal" className="text-white">
                        Coin Goal (threshold)
                      </Label>
                      <Input
                        id="coin-goal"
                        type="number"
                        placeholder="e.g., 100"
                        value={payoutGoalAmount}
                        onChange={(e) => setPayoutGoalAmount(e.target.value)}
                        disabled={isSettingPayoutGoal}
                        className="bg-white/10 border-white/20 text-white"
                      />
                      <p className="text-xs text-gray-400">
                        When user reaches this coin balance, they'll get paid out
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payout-amount" className="text-white">
                        Payout Amount (coins to deduct)
                      </Label>
                      <Input
                        id="payout-amount"
                        type="number"
                        placeholder="e.g., 100"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        disabled={isSettingPayoutGoal}
                        className="bg-white/10 border-white/20 text-white"
                      />
                      <p className="text-xs text-gray-400">
                        Amount deducted when payout triggers
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSettingPayoutGoal}
                      className="w-full neon-btn-gold text-black font-semibold"
                    >
                      {isSettingPayoutGoal ? 'Setting...' : 'Set Payout Goal'}
                    </Button>
                  </form>

                  <Button
                    onClick={handleProcessPayouts}
                    disabled={isProcessingPayouts}
                    className="w-full mt-4 neon-btn-gold text-black font-semibold"
                  >
                    {isProcessingPayouts ? 'Processing...' : 'Process Payouts Now'}
                  </Button>
                  <p className="text-xs text-gray-400 mt-2">
                    Normally runs automatically on Mondays and Fridays
                  </p>
                </div>

                {/* Payout Goals List */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Active Payout Goals</h3>
                  {isLoadingPayouts ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded" />
                      ))}
                    </div>
                  ) : payoutGoals.length > 0 ? (
                    <div className="space-y-3">
                      {payoutGoals.map((goal) => (
                        <div key={goal.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <p className="text-sm text-gray-400 font-mono">
                                User: {goal.user_id.substring(0, 8)}...
                              </p>
                              <p className="text-sm text-yellow-400 mt-1">
                                Goal: <span className="font-semibold">{goal.coin_goal.toLocaleString()}</span> coins
                              </p>
                              <p className="text-sm text-blue-400">
                                Payout: <span className="font-semibold">{goal.payout_amount.toLocaleString()}</span> coins
                              </p>
                              {goal.last_payout_date && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Last: {new Date(goal.last_payout_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleTogglePayoutGoal(goal.user_id, goal.enabled)}
                                className={`p-2 rounded transition ${goal.enabled ? 'text-green-400 hover:bg-green-400/20' : 'text-gray-400 hover:bg-gray-400/20'}`}
                              >
                                <Power size={16} />
                              </button>
                              <button
                                onClick={() => handleDeletePayoutGoal(goal.user_id)}
                                className="p-2 text-red-400 hover:bg-red-400/20 rounded transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${goal.enabled ? 'bg-green-400/20 text-green-400' : 'bg-gray-400/20 text-gray-400'}`}>
                            {goal.enabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>No payout goals configured</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-6">
              <div className="card-glow rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Film className="text-yellow-400" size={28} />
                    Content Management
                  </h2>
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setContentFilter(status)}
                      className={`px-4 py-2 rounded-lg font-semibold transition ${
                        contentFilter === status
                          ? 'bg-yellow-400 text-black neon-glow-gold'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      {status === 'all' ? 'All Content' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Content Grid */}
                {isLoadingContent ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-96 rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <>
                    {content.filter((c) => contentFilter === 'all' || c.status === contentFilter).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {content
                          .filter((c) => contentFilter === 'all' || c.status === contentFilter)
                          .map((item) => (
                            <div
                              key={item.id}
                              className="bg-black border border-yellow-400/30 rounded-lg overflow-hidden hover:border-yellow-400 hover:shadow-lg hover:shadow-yellow-400/20 transition group"
                            >
                              {/* Thumbnail */}
                              {item.thumbnail_url && (
                                <div className="relative h-40 bg-gray-900 overflow-hidden">
                                  <img
                                    src={item.thumbnail_url}
                                    alt={item.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                                  <span className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold bg-yellow-400 text-black">
                                    {item.type.toUpperCase()}
                                  </span>
                                </div>
                              )}

                              {/* Content Info */}
                              <div className="p-4 space-y-3">
                                <div>
                                  <h3 className="font-bold text-white text-sm line-clamp-2">{item.title}</h3>
                                  <p className="text-xs text-gray-400 mt-1">
                                    by <span className="text-yellow-400 font-semibold">{item.creator?.display_name || 'Unknown'}</span>
                                  </p>
                                </div>

                                {/* Status Badge */}
                                <div>
                                  <span
                                    className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                                      item.status === 'approved'
                                        ? 'bg-green-500/20 text-green-400'
                                        : item.status === 'rejected'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                    }`}
                                  >
                                    {item.status.toUpperCase()}
                                  </span>
                                </div>

                                {/* Stats */}
                                <div className="flex justify-between text-xs text-gray-400 pt-2 border-t border-white/10">
                                  <span>{item.views.toLocaleString()} views</span>
                                  <span>{item.likes.toLocaleString()} likes</span>
                                </div>

                                {/* Actions */}
                                <div className="space-y-2 pt-2 border-t border-white/10">
                                  {item.status !== 'approved' && (
                                    <button
                                      onClick={() => handleUpdateContentStatus(item.id, 'approved')}
                                      className="w-full px-3 py-2 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 font-semibold text-sm transition"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  {item.status !== 'rejected' && (
                                    <button
                                      onClick={() => handleUpdateContentStatus(item.id, 'rejected')}
                                      className="w-full px-3 py-2 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold text-sm transition"
                                    >
                                      Reject
                                    </button>
                                  )}
                                  <div className="grid grid-cols-2 gap-2 pt-2">
                                    {item.creator && (
                                      <>
                                        {item.creator.role === 'creator' ? (
                                          <button
                                            onClick={() => handleRestrictCreator(item.creator_id)}
                                            className="px-2 py-2 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 font-semibold text-xs transition"
                                          >
                                            Restrict Creator
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleUnrestrictCreator(item.creator_id)}
                                            className="px-2 py-2 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-semibold text-xs transition"
                                          >
                                            Unrestrict
                                          </button>
                                        )}
                                      </>
                                    )}
                                    <button
                                      onClick={() => handleDeleteContent(item.id)}
                                      className="px-2 py-2 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-semibold text-xs transition flex items-center justify-center gap-1"
                                    >
                                      <Trash2 size={14} />
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-400">
                        <Film size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No {contentFilter !== 'all' ? contentFilter : ''} content</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
}
