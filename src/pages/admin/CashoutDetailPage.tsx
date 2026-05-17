import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  DollarSign,
  Coins,
  Users,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  FileText,
  User as UserIcon,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/store';
import { toast } from 'sonner';
import type {
  CashoutDetails,
  GiftBreakdown,
  PayoutMethod,
} from '../../types/cashout';
import {
  isAdminOrSecretary,
  calculateFeeCoins,
} from '../../lib/supabase';

const RECEIPT_BUCKET = 'receipts';

export default function AdminCashoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<CashoutDetails | null>(null);
  const [processing, setProcessing] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [denialReason, setDenialReason] = useState('');
  const [showDenialModal, setShowDenialModal] = useState(false);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [manualVerification, setManualVerification] = useState<{ senderId: string; isEligible: boolean; notes: string } | null>(null);

  // Check admin permissions
  const isAuthorized = profile && isAdminOrSecretary(profile);

  // Load cashout details
  const loadDetails = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_cashout_request_details', {
        p_cashout_id: id,
      });

      if (error) throw error;
      if (data && data.success) {
        setDetails(data);
      } else {
        toast.error('Failed to load cashout request');
      }
    } catch (err: any) {
      console.error('Error loading cashout details:', err);
      toast.error('Failed to load cashout details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetails();
    
    // Subscribe to changes
    const channel = supabase
      .channel(`admin_cashout_${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visa_redemptions',
          filter: `id=eq.${id}`,
        },
        () => {
          loadDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Handle opening the request (change to processing)
  const handleOpenRequest = async () => {
    if (!id || !profile) return;

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('admin_open_cashout_request', {
        p_admin_id: profile.id,
        p_cashout_id: id,
      });

      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || 'Failed to open request');
      }

      toast.success('Request opened for review');
      await loadDetails();
    } catch (err: any) {
      toast.error('Failed to open request: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  // Handle approval
  const handleApprove = async () => {
    if (!id || !profile) return;

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('admin_process_cashout_request', {
        p_admin_id: profile.id,
        p_cashout_id: id,
        p_action: 'approve',
      });

      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || 'Failed to approve');
      }

      toast.success('Cashout request approved');
      await loadDetails();
    } catch (err: any) {
      toast.error('Failed to approve: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  // Handle denial
  const handleDeny = async () => {
    if (!id || !profile || !denialReason.trim()) {
      toast.error('Please provide a reason for denial');
      return;
    }

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('admin_process_cashout_request', {
        p_admin_id: profile.id,
        p_cashout_id: id,
        p_action: 'deny',
        p_reason: denialReason,
      });

      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || 'Failed to deny');
      }

      toast.success('Cashout request denied');
      setShowDenialModal(false);
      await loadDetails();
    } catch (err: any) {
      toast.error('Failed to deny: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  // Handle receipt upload
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile || !id) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, WebP, or PDF files are allowed');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }

    try {
      setReceiptUploading(true);

      const fileName = `receipts/${id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(RECEIPT_BUCKET)
        .getPublicUrl(fileName);

      setReceiptUrl(urlData.publicUrl);

      // Complete cashout with receipt
      const { data, error: completeError } = await supabase.rpc(
        'admin_complete_cashout_with_receipt',
        {
          p_admin_id: profile.id,
          p_cashout_id: id,
          p_receipt_url: urlData.publicUrl,
          p_admin_notes: '',
        }
      );

      if (completeError) throw completeError;
      if (!data.success) {
        throw new Error(data.error || 'Failed to complete cashout');
      }

      toast.success('Cashout completed with receipt');
      await loadDetails();
    } catch (err: any) {
      console.error('Receipt upload error:', err);
      toast.error('Failed: ' + (err.message || 'Unknown error'));
    } finally {
      setReceiptUploading(false);
    }
  };

  // Handle manual gift verification
  const handleManualVerification = async () => {
    if (!id || !profile || !manualVerification) return;

    try {
      setProcessing(true);
      const { data, error } = await supabase.rpc('admin_verify_gift_eligibility', {
        p_admin_id: profile.id,
        p_cashout_id: id,
        p_sender_id: manualVerification.senderId,
        p_is_eligible: manualVerification.isEligible,
        p_notes: manualVerification.notes,
      });

      if (error) throw error;
      if (!data.success) {
        throw new Error(data.error || 'Verification failed');
      }

      toast.success('Gift eligibility updated');
      setManualVerification(null);
      await loadDetails();
    } catch (err: any) {
      toast.error('Failed: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
          <p className="text-slate-400">Only administrators and secretaries can access this page.</p>
          <Link to="/admin" className="text-cyan-400 hover:underline mt-4 inline-block">
            Back to Admin Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-t-troll-gold border-r-transparent border-b-transparent border-l-transparent" />
          <p className="mt-4 text-slate-400">Loading cashout details...</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-4xl mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Request Not Found</h1>
          <p className="text-slate-400 mb-4">The cashout request could not be found.</p>
          <Link to="/admin/cashout-manager" className="text-cyan-400 hover:underline">
            Back to Cashout Manager
          </Link>
        </div>
      </div>
    );
  }

  const { cashout, user: requestedUser, gift_breakdown, summary } = details;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-troll-gold" />
              Cashout Request Details
            </h1>
            <p className="text-slate-400 mt-1">
              Request #{cashout.id.slice(0, 8)} • {new Date(cashout.requested_at).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-3">
            {cashout.status === 'pending' && (
              <button
                onClick={handleOpenRequest}
                disabled={processing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Open for Review
              </button>
            )}
            {cashout.status === 'processing' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => setShowDenialModal(true)}
                  disabled={processing}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Deny
                </button>
              </>
            )}
            {cashout.status === 'approved' && (
              <button
                onClick={() => document.getElementById('receipt-upload')?.click()}
                disabled={processing || receiptUploading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {receiptUploading ? 'Uploading...' : 'Upload Receipt'}
              </button>
            )}
            <input
              id="receipt-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleReceiptUpload}
              disabled={receiptUploading || cashout.status !== 'approved'}
            />
          </div>
        </div>

        {/* Status Badge */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm ${
          cashout.status === 'pending' ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700' :
          cashout.status === 'processing' ? 'bg-blue-900/30 text-blue-300 border border-blue-700' :
          cashout.status === 'approved' ? 'bg-green-900/30 text-green-300 border border-green-700' :
          cashout.status === 'completed' ? 'bg-green-900/30 text-green-300 border border-green-700' :
          'bg-red-900/30 text-red-300 border border-red-700'
        }`}>
          <Clock className="w-4 h-4" />
          STATUS: {cashout.status.toUpperCase()}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Request Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Summary */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Request Summary
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-400">User</p>
                  <p className="font-bold text-white">{requestedUser.username}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Coins Redeemed</p>
                  <p className="font-bold text-troll-gold">{cashout.eligible_gift_coins_used?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Net After Fee</p>
                  <p className="font-bold text-green-300">{cashout.net_coins?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Cash Amount</p>
                  <p className="font-bold text-white">${cashout.usd_amount?.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Fee Coins</p>
                  <p className="font-mono text-red-300">-{cashout.fee_coins?.toLocaleString() || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Payout Method</p>
                  <p className="font-mono text-white capitalize">{cashout.payout_method || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Provider Account</p>
                  <p className="font-mono text-white text-sm">{cashout.payout_details || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">ID Uploaded</p>
                  <p className="font-mono text-white">
                    {cashout.id_verification_url ? (
                      <a href={cashout.id_verification_url} target="_blank" rel="noopener noreferrer" className="text-troll-green-neon hover:underline">
                        View ID
                      </a>
                    ) : 'Not uploaded'}
                  </p>
                </div>
              </div>

              {cashout.receipt_url && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400 mb-2">Payment Receipt</p>
                  <a
                    href={cashout.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-troll-green-neon hover:underline"
                  >
                    <Receipt className="w-4 h-4" />
                    View Receipt
                  </a>
                  <p className="text-xs text-slate-500 mt-1">
                    Uploaded: {new Date(cashout.receipt_uploaded_at || '').toLocaleString()}
                  </p>
                </div>
              )}

              {cashout.rejection_reason && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-300">
                    <strong>Denial Reason:</strong> {cashout.rejection_reason}
                  </p>
                </div>
              )}

              {cashout.admin_notes && (
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
                  <p className="text-sm text-blue-300">
                    <strong>Admin Notes:</strong> {cashout.admin_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Gift Breakdown */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-troll-gold" />
                Gift Breakdown by Sender
                <span className="text-sm font-normal text-slate-400">
                  ({summary?.distinct_senders || gift_breakdown?.length || 0} unique senders)
                </span>
              </h2>

              <p className="text-sm text-slate-400 mb-4">
                Total eligible gift coins: <span className="text-white font-bold">{summary?.eligible_gift_coins?.toLocaleString() || 0}</span>.
                Review each sender&apos;s contribution and verify eligibility.
              </p>

              {!gift_breakdown || gift_breakdown.length === 0 ? (
                <p className="text-slate-500">No gift history found for this user.</p>
              ) : (
                <div className="space-y-3">
                  {gift_breakdown.map((gift: GiftBreakdown, idx: number) => (
                    <div
                      key={`${gift.sender_id}-${idx}`}
                      className={`p-4 rounded-lg border ${
                        gift.is_eligible
                          ? 'bg-emerald-900/20 border-emerald-700/50'
                          : 'bg-red-900/20 border-red-700/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-slate-400" />
                            <p className="font-bold text-white">{gift.sender_username}</p>
                            {gift.is_manually_verified && (
                              <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded-full">
                                Manually Verified
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mt-1">
                            {gift.gift_count.toLocaleString()} gifts • Total: {gift.total_coins.toLocaleString()} coins
                          </p>
                          {gift.notes && (
                            <p className="text-xs text-slate-500 mt-1 italic">Note: {gift.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-bold ${
                              gift.is_eligible
                                ? 'bg-emerald-900/50 text-emerald-300'
                                : 'bg-red-900/50 text-red-300'
                            }`}
                          >
                            {gift.is_eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                          </span>
                          <p className="text-xs text-slate-500 mt-1">
                            {gift.coin_type === 'paid' ? 'Paid Coins' : 'Free Coins'}
                          </p>
                        </div>
                      </div>

                      {/* Admin Actions for this sender */}
                      {(cashout.status === 'pending' || cashout.status === 'processing') && isAuthorized && (
                        <div className="mt-3 pt-3 border-t border-slate-700 flex gap-2">
                          <button
                            onClick={() => {
                              setManualVerification({
                                senderId: gift.sender_id,
                                isEligible: true,
                                notes: '',
                              });
                            }}
                            disabled={gift.is_manually_verified}
                            className="text-xs px-2 py-1 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 rounded disabled:opacity-50"
                          >
                            Mark Eligible
                          </button>
                          <button
                            onClick={() => {
                              setManualVerification({
                                senderId: gift.sender_id,
                                isEligible: false,
                                notes: '',
                              });
                            }}
                            disabled={gift.is_manually_verified}
                            className="text-xs px-2 py-1 bg-red-900/30 text-red-300 hover:bg-red-900/50 rounded disabled:opacity-50"
                          >
                            Mark Ineligible
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Eligibility Summary */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <h2 className="text-lg font-bold text-white mb-3">Eligibility Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Gift Coins Received</span>
                  <span className="text-white">{summary?.total_gift_coins?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Eligible for Cashout</span>
                  <span className="text-emerald-300">{summary?.eligible_gift_coins?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Requested in this Cashout</span>
                  <span className="text-troll-gold">{cashout.eligible_gift_coins_used?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-700">
                  <span className="text-slate-300 font-bold">Verdict</span>
                  <span className={summary?.eligible_for_cashout ? 'text-emerald-400' : 'text-red-400'}>
                    {summary?.eligible_for_cashout ? '✓ Sufficient Eligible Coins' : '✗ Insufficient Eligible Coins'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Admin Actions */}
          <div className="space-y-6">
            {/* User Info */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                User Information
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-slate-400">Username</p>
                  <p className="text-white font-medium">{requestedUser.username}</p>
                </div>
                <div>
                  <p className="text-slate-400">User ID</p>
                  <p className="font-mono text-slate-300">{requestedUser.id}</p>
                </div>
                <div>
                  <p className="text-slate-400">Current Balance</p>
                  <p className="text-white">{requestedUser.troll_coins?.toLocaleString()} coins</p>
                </div>
                <div>
                  <p className="text-slate-400">Reserved</p>
                  <p className="text-yellow-300">{requestedUser.reserved_troll_coins?.toLocaleString()} coins</p>
                </div>
              </div>
            </div>

            {/* Request Timeline */}
            <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-3">Timeline</h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                  <div>
                    <p className="text-white">Requested</p>
                    <p className="text-slate-400">{new Date(cashout.requested_at).toLocaleString()}</p>
                  </div>
                </div>
                {cashout.opened_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5" />
                    <div>
                      <p className="text-white">Opened by Admin</p>
                      <p className="text-slate-400">{new Date(cashout.opened_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                {cashout.processed_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <div>
                      <p className="text-white">{cashout.status === 'completed' ? 'Completed' : 'Processed'}</p>
                      <p className="text-slate-400">{new Date(cashout.processed_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* Denial Modal */}
      {showDenialModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Deny Cashout Request
              </h3>
              <button
                onClick={() => setShowDenialModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-900/20 border border-red-800 p-4 rounded-lg">
              <p className="text-sm text-red-200">
                This action will deny the cashout request and refund coins to the user.
                Please provide a reason for the denial.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Reason for Denial</label>
              <textarea
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                placeholder="e.g., Insufficient eligible gift coins, ID verification failed, suspicious activity..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 h-24 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDenialModal(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-gray-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeny}
                disabled={processing || !denialReason.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                Confirm Denial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Verification Modal */}
      {manualVerification && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              Manual Verification for {manualVerification.senderId}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Override automatic eligibility determination for this sender.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  handleManualVerification().then(() => setManualVerification(null));
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded disabled:opacity-50"
              >
                Mark Eligible
              </button>
              <button
                onClick={() => {
                  handleManualVerification().then(() => setManualVerification(null));
                }}
                disabled={processing}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50"
              >
                Mark Ineligible
              </button>
            </div>
            <button
              onClick={() => setManualVerification(null)}
              className="mt-2 w-full text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
