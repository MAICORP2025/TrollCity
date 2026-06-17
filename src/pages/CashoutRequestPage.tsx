import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign,
  Coins,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  Lock,
  User,
  Building,
  Wallet as WalletIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/store';
import { toast } from 'sonner';
import type {
  CashoutRequest,
  PayoutMethod,
  RequestCashoutResponse,
} from '../types/cashout';
import {
  calculateFeeCoins,
  calculateNetCoins,
  isCashoutWindowOpen,
  CASHOUT_TIERS as TIERS,
  type CashoutTier,
} from '../config/coinConfig';

const PAYOUT_METHODS: { value: PayoutMethod; label: string; icon: React.ReactNode }[] = [
  {
    value: 'cash_app',
    label: 'Cash App',
    icon: <Building className="w-5 h-5" />,
  },
  {
    value: 'paypal',
    label: 'PayPal',
    icon: <WalletIcon className="w-5 h-5" />,
  },
  {
    value: 'venmo',
    label: 'Venmo',
    icon: <User className="w-5 h-5" />,
  },
];

const MAX_MONTHLY_CASHOUTS = 4;

const ID_BUCKET = 'verification_docs';

export default function CashoutRequestPage() {
  const { profile, refreshProfile } = useAuthStore();
  const navigate = useNavigate();

  // State
  const [eligibleCoins, setEligibleCoins] = useState<number>(0);
  const [selectedTier, setSelectedTier] = useState<CashoutTier | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('paypal');
  const [providerUsername, setProviderUsername] = useState('');
  const [userTag, setUserTag] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idUploading, setIdUploading] = useState(false);
  const [idUrl, setIdUrl] = useState<string | null>(null);
  const [lastApprovedAt, setLastApprovedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentRequests, setRecentRequests] = useState<CashoutRequest[]>([]);
  const [monthlyCashoutCount, setMonthlyCashoutCount] = useState(0);
  const [activeGamingLoan, setActiveGamingLoan] = useState<any>(null);
  const [checkingLoan, setCheckingLoan] = useState(true);

  const hasRecentApprovedPayout = useMemo(() => {
    if (!lastApprovedAt) return false;
    return new Date(lastApprovedAt).getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000;
  }, [lastApprovedAt]);

  const requiresIdUpload = !hasRecentApprovedPayout;

   // Derived state for display
   const feeCoins = selectedTier ? calculateFeeCoins(selectedTier.coins) : 0;
   const netCoins = selectedTier ? calculateNetCoins(selectedTier.coins, feeCoins) : 0;
   const usdAmount = selectedTier ? selectedTier.usd : 0;

     const isFriday = isCashoutWindowOpen();
     const monthlyCapReached = monthlyCashoutCount >= MAX_MONTHLY_CASHOUTS;
     const hasActiveGamingLoan = activeGamingLoan?.has_active_loan === true;
     const canRequest = isFriday && eligibleCoins >= (selectedTier?.coins || 0) && (!requiresIdUpload || idUrl) && providerUsername.trim() && userTag.trim() && !monthlyCapReached && !hasActiveGamingLoan;

  // Load user's troll_coins balance and recent payout requests
  const getSavedPayoutUsername = useCallback((method: PayoutMethod) => {
    if (!profile) return '';
    switch (method) {
      case 'paypal':
        return profile.paypal_email || '';
      case 'cash_app':
        return profile.cashapp_handle ? profile.cashapp_handle.replace(/\$/g, '') : '';
      case 'venmo':
        return profile.venmo_handle || '';
      default:
        return '';
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const preferredMethod = (profile.preferred_payout_method as PayoutMethod) || (
      profile.paypal_email ? 'paypal' : profile.venmo_handle ? 'venmo' : 'cash_app'
    );

    setPayoutMethod(preferredMethod);
    const savedProvider = getSavedPayoutUsername(preferredMethod);
    if (savedProvider) setProviderUsername(savedProvider);
  }, [profile, getSavedPayoutUsername]);

  useEffect(() => {
    if (!profile) return;
    if (providerUsername.trim()) return;

    const savedProvider = getSavedPayoutUsername(payoutMethod);
    if (savedProvider) setProviderUsername(savedProvider);
  }, [profile, payoutMethod, providerUsername, getSavedPayoutUsername]);

  useEffect(() => {
    async function loadData() {
      if (!profile) return;

      try {
        setLoading(true);

        // Use cashout escrow balance only; free or non-cashout coins do not qualify.
        const eligibleTotal = Math.max(0, (profile.cashout_coins || 0) - (profile.cashout_reserved_coins || 0));
        setEligibleCoins(eligibleTotal);

        // Load recent payout requests
        const { data: requestsData, error: requestsError } = await supabase
          .from('payout_requests')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (requestsError) throw requestsError;
        setRecentRequests(requestsData || []);

        // Load last approved payout date to optionally skip ID upload for 30 days
        const { data: lastApprovedData, error: lastApprovedError } = await supabase
          .from('payout_requests')
          .select('created_at')
          .eq('user_id', profile.id)
          .in('status', ['approved', 'completed'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (lastApprovedError) throw lastApprovedError;
        setLastApprovedAt(lastApprovedData?.[0]?.created_at || null);

        // Count this month's cashouts (non-rejected)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { count: monthCount, error: monthCountError } = await supabase
          .from('payout_requests')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .not('status', 'in', '("rejected")')
          .gte('created_at', monthStart);

        if (monthCountError) throw monthCountError;
        setMonthlyCashoutCount(monthCount || 0);

        // Auto-select highest eligible tier based on the loaded balance
        const eligibleTier = [...TIERS].reverse().find(t => t.coins <= eligibleTotal) || TIERS[0];
        if (eligibleTier) setSelectedTier(eligibleTier);

        // Check for active gaming loan
        const { data: loanData } = await supabase.rpc('has_active_gaming_loan');
        if (loanData?.has_active_loan) {
          setActiveGamingLoan(loanData);
        } else {
          setActiveGamingLoan(null);
        }
      } catch (err: any) {
        console.error('Failed to load cashout data:', err);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
        setCheckingLoan(false);
      }
    }

    loadData();
  }, [profile]);

  // Real-time subscription for payout status updates
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`payout_requests_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          supabase
            .from('payout_requests')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data }) => {
              if (data) setRecentRequests(data);
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Handle ID file upload
  const handleIdUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, WebP, or PDF files are allowed for ID upload');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be less than 5MB');
      return;
    }

    try {
      setIdUploading(true);

      // Upload to Supabase Storage
      const fileName = `verification_docs/${profile.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(ID_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get signed URL (verification_docs is private)
      const { data: urlData, error: signError } = await supabase.storage
        .from(ID_BUCKET)
        .createSignedUrl(fileName, 600);
      if (signError) throw signError;

      setIdUrl(urlData.signedUrl);
      toast.success('ID uploaded successfully');
    } catch (err: any) {
      console.error('ID upload error:', err);
      toast.error('Failed to upload ID: ' + (err.message || 'Unknown error'));
    } finally {
      setIdUploading(false);
    }
  }, [profile]);

  // Handle cashout submission
  const handleSubmit = useCallback(async () => {
    if (!profile || !selectedTier || (requiresIdUpload && !idUrl)) {
      toast.error('Missing required fields');
      return;
    }

    if (!isFriday) {
      toast.error('Cashout requests are only available during the weekend payout window.');
      return;
    }

    if (eligibleCoins < selectedTier.coins) {
      toast.error('Insufficient eligible gift coins');
      return;
    }

    if (monthlyCapReached) {
      toast.error(`Monthly cashout limit reached. You have used ${monthlyCashoutCount} of ${MAX_MONTHLY_CASHOUTS} cashouts this month.`);
      return;
    }

    if (activeGamingLoan?.has_active_loan) {
      toast.error('Cashouts are blocked while you have an active gaming agency loan. Please pay off your loan first.');
      return;
    }

    if (!providerUsername.trim()) {
      toast.error('Please enter your ' + getPayoutLabel(payoutMethod) + ' username/email');
      return;
    }

    try {
      setSubmitting(true);

       const { data, error } = await supabase.rpc('request_friday_cashout', {
         p_user_id: profile.id,
         p_coins_to_redeem: selectedTier.coins,
         p_provider_type: payoutMethod,
         p_provider_username: providerUsername.trim(),
         p_user_tag: userTag.trim() || null,
         p_id_verification_url: idUrl || null,
       });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Cashout request failed');
      }

      toast.success('Cashout request submitted! It will be reviewed by CEO Assistant and Noah Assistant before admin processing.');

      // Refresh profile to update balances
      await refreshProfile();

      // Redirect to wallet or stay and show success
      navigate('/wallet');
    } catch (err: any) {
      console.error('Cashout submission error:', err);
      toast.error('Failed to submit cashout request: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  }, [profile, selectedTier, payoutMethod, providerUsername, userTag, idUrl, eligibleCoins, isFriday, refreshProfile, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05030B] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-troll-gold border-r-transparent" />
          <p className="mt-4 text-troll-purple-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05030B] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="bg-troll-gold/20 p-3 rounded-full">
              <DollarSign className="w-8 h-8 text-troll-gold" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold text-white mb-2">Request Cashout</h1>
              <p className="text-gray-300">
                Convert your eligible cashout coins into real payout requests. Only coins moved into Cashout Escrow are eligible for payout; free or non-cashout coins are excluded.
                Eligible cashout coins are added on Thursdays, and cashout requests are processed on weekends by the CEO Assistant and Noah Assistant before admin payout.
              </p>
            </div>
          </div>

          {/* Friday Gating Warning */}
           {!isFriday && (
             <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
               <Lock className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
               <div>
                 <h4 className="font-bold text-red-400">Cashouts Are Closed</h4>
                 <p className="text-sm text-red-300/80">
                   Cashout requests are only accepted on Friday, Saturday, and Sunday between 1:00 AM - 7:00 PM Mountain Time.
                   Please come back during that window to submit your request.
                 </p>
               </div>
             </div>
           )}

            {/* Monthly Cashout Cap */}
            {monthlyCapReached && (
              <div className="mt-4 bg-amber-900/30 border border-amber-700 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-400">Monthly Cashout Limit Reached</h4>
                  <p className="text-sm text-amber-300/80">
                    You have used {monthlyCashoutCount} of {MAX_MONTHLY_CASHOUTS} cashouts this month.
                    Your cap resets on the 1st of each month.
                  </p>
                </div>
              </div>
            )}

            {/* Gaming Loan Block */}
            {activeGamingLoan?.has_active_loan && (
              <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-4 flex items-start gap-3">
                <Lock className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-red-400">Cashouts Blocked — Active Gaming Loan</h4>
                  <p className="text-sm text-red-300/80">
                    You have an active gaming agency loan with a remaining balance of{' '}
                    <strong>{activeGamingLoan.balance?.toLocaleString()} TC</strong>.
                    All cashouts are disabled until the loan is fully paid off.
                    Principal: {activeGamingLoan.principal?.toLocaleString()} TC.
                  </p>
                  <p className="mt-2 text-xs text-red-400/70">
                    Pay off your loan through the Gaming Dashboard to unlock cashouts.
                  </p>
                </div>
              </div>
            )}

           </div>

         {/* Cashout Form */}
       <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6 shadow-lg space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Coins className="text-troll-gold" />
            Cashout Details
          </h2>

          {/* Tier Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Cashout Tier
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {TIERS.map((tier) => {
                const isDisabled = eligibleCoins < tier.coins;
                const isSelected = selectedTier?.coins === tier.coins;
                return (
                  <button
                    key={tier.coins}
                    onClick={() => setSelectedTier(tier)}
                    disabled={isDisabled}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? 'border-troll-gold bg-troll-gold/10'
                        : isDisabled
                        ? 'border-gray-700 bg-gray-900/30 cursor-not-allowed opacity-50'
                        : 'border-purple-600 bg-purple-900/20 hover:border-purple-400'
                    }`}
                  >
                    <div className="text-lg font-bold text-white">{tier.coins.toLocaleString()}</div>
                    <div className="text-sm text-troll-gold">${tier.usd.toFixed(2)}</div>
                    {tier.manualReview && (
                      <div className="text-xs text-yellow-300 mt-1">* Manual Review</div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * Cashout amounts are based on eligible gift coins only.
            </p>
          </div>

          {/* Fee Summary */}
          {selectedTier && (
            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
              <h3 className="text-sm font-bold text-white mb-3">Fee Calculation</h3>
              <div className="space-y-2 text-sm">
                 <div className="flex justify-between">
                   <span className="text-gray-400">Requested Amount</span>
                   <span className="text-white font-mono">{selectedTier.coins.toLocaleString()} coins</span>
                 </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Processing Fee (2.9%)</span>
                  <span className="text-red-300 font-mono">-{feeCoins.toLocaleString()} coins</span>
                </div>
                <div className="flex justify-between text-troll-gold font-bold pt-2 border-t border-purple-700/30">
                  <span>Net Amount</span>
                  <span>{netCoins.toLocaleString()} coins (${usdAmount.toFixed(2)})</span>
                </div>
              </div>
            </div>
          )}

          {/* Payout Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payout Method
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PAYOUT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => setPayoutMethod(method.value)}
                  className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                    payoutMethod === method.value
                      ? 'border-troll-green-neon bg-troll-green-neon/10'
                      : 'border-gray-700 bg-gray-900/30 hover:border-gray-500'
                  }`}
                >
                  <div className={payoutMethod === method.value ? 'text-troll-green-neon' : 'text-gray-400'}>
                    {method.icon}
                  </div>
                  <span className={`font-medium ${payoutMethod === method.value ? 'text-white' : 'text-gray-400'}`}>
                    {method.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Payout Provider Username */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {getPayoutLabel(payoutMethod)} Username / Handle / Email
            </label>
            <div className="relative">
              <input
                type="text"
                value={providerUsername}
                onChange={(e) => setProviderUsername(e.target.value)}
                placeholder={getPayoutPlaceholder(payoutMethod)}
                className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-troll-gold"
                disabled={!isFriday}
              />
              {providerUsername.trim() && (
                <CheckCircle className="absolute right-3 top-3 w-5 h-5 text-green-400" />
              )}
            </div>
          </div>

          {/* User Tag */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Tag / Cashtag / Identifier
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Enter your identifier for the payout provider (e.g. CashApp $Cashtag, Venmo handle, or PayPal email). Admin will see this when processing your payout.
            </p>
            <div className="relative">
              <input
                type="text"
                value={userTag}
                onChange={(e) => setUserTag(e.target.value)}
                placeholder="$Cashtag, @handle, or email"
                className="w-full bg-[#171427] border border-purple-500/40 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-troll-gold"
                disabled={!isFriday}
              />
              {userTag.trim() && (
                <CheckCircle className="absolute right-3 top-3 w-5 h-5 text-green-400" />
              )}
            </div>
          </div>

          {/* ID Verification Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Upload ID Verification
              {requiresIdUpload ? (
                <span className="text-red-400 ml-1">*</span>
              ) : (
                <span className="text-green-400 ml-1">(optional for this request)</span>
              )}
            </label>
            <p className="text-xs text-gray-500 mb-2">
              For security, we require a photo of your government-issued ID. This will be reviewed by our admin team.
            </p>
            {!requiresIdUpload && lastApprovedAt && (
              <p className="text-sm text-green-300 mb-2">
                Your last approved payout was on {new Date(lastApprovedAt).toLocaleDateString()}. ID upload is optional for 30 days after approval.
              </p>
            )}

            {!idUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-500/40 rounded-lg cursor-pointer bg-[#171427] hover:bg-purple-900/20 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {idUploading ? (
                    <>
                      <div className="w-8 h-8 border-4 border-t-troll-gold border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mb-2" />
                      <p className="text-sm text-troll-gold">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-400">
                        <span className="font-semibold">Click to upload</span> ID photo or PDF
                      </p>
                      <p className="text-xs text-gray-500">JPG, PNG, PDF (max 5MB)</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleIdUpload}
                  disabled={idUploading || !isFriday}
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-700 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div className="flex-1 text-sm">
                  <p className="text-green-300 font-medium">ID uploaded</p>
                  <p className="text-green-500/80 text-xs truncate">{idUrl}</p>
                </div>
                <button
                  onClick={() => {
                    setIdUrl(null);
                    // Optionally delete from storage
                  }}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!canRequest || submitting}
            className={`w-full py-3 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
              canRequest
                ? 'bg-gradient-to-r from-troll-green to-troll-green-neon text-troll-purple-900 hover:shadow-lg hover:shadow-troll-gold/25'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-t-troll-purple-900 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : !isFriday ? (
                <>
                  <Clock className="w-5 h-5" />
                  Weekend Cashout Window Closed
                </>
              ) : monthlyCapReached ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  Monthly Limit Reached ({monthlyCashoutCount}/{MAX_MONTHLY_CASHOUTS})
                </>
              ) : activeGamingLoan?.has_active_loan ? (
                <>
                  <Lock className="w-5 h-5" />
                  Cashouts Blocked — Gaming Loan Active
                </>
              ) : eligibleCoins < (selectedTier?.coins || 0) ? (
               <>
                 <AlertCircle className="w-5 h-5" />
                 Insufficient Eligible Coins
               </>
             ) : !idUrl ? (
               <>
                 <Upload className="w-5 h-5" />
                 Upload ID Required
               </>
             ) : !providerUsername.trim() ? (
               <>
                 <AlertCircle className="w-5 h-5" />
                 Enter Payout Details
               </>
             ) : (
               <>
                 <DollarSign className="w-5 h-5" />
                 Request Payout
               </>
             )}
          </button>

          <p className="text-xs text-gray-500 text-center">
            By requesting a cashout, you confirm that the payout information is correct.
            Cashout requests are manually reviewed by our admin team. Processing time: 30 minutes
          </p>
        </div>

        {/* Recent Requests */}
        <div className="bg-[#0E0A1A] rounded-xl border border-purple-700/40 p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock className="text-troll-gold" />
            Recent Cashout Requests
          </h3>
          {recentRequests.length === 0 ? (
            <p className="text-sm text-gray-400">No cashout requests yet.</p>
          ) : (
            <div className="space-y-3">
              {recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-[#151027] rounded-lg border border-purple-500/20"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {req.coins_reserved?.toLocaleString() || 0} coins
                    </p>
                    <p className="text-xs text-gray-400">
                      ${req.usd_amount?.toFixed(2) || '0.00'} • {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-1 text-xs rounded-full font-bold ${
                        req.status === 'pending' || req.status === 'submitted'
                          ? 'bg-yellow-900/50 text-yellow-300'
                          : req.status === 'processing'
                          ? 'bg-blue-900/50 text-blue-300'
                          : req.status === 'approved'
                          ? 'bg-green-900/50 text-green-300'
                          : req.status === 'completed'
                          ? 'bg-green-900/50 text-green-300'
                          : 'bg-red-900/50 text-red-300'
                      }`}
                    >
                      {req.status.toUpperCase()}
                    </span>
                    {req.payout_method && (
                      <p className="text-xs text-gray-500 mt-1 capitalize">{req.payout_method}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Helper
function getPayoutLabel(method: PayoutMethod): string {
  switch (method) {
    case 'cash_app':
      return 'Cash App $Cashtag';
    case 'paypal':
      return 'PayPal Email';
    case 'venmo':
      return 'Venmo Username';
  }
}

function getPayoutPlaceholder(method: PayoutMethod): string {
  switch (method) {
    case 'cash_app':
      return '$YourCashtag';
    case 'paypal':
      return 'your@email.com';
    case 'venmo':
      return '@YourVenmoHandle';
  }
}
