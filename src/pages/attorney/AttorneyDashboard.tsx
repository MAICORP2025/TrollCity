import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Briefcase, Users, MessageSquare, DollarSign, FileText, User, CheckCircle, XCircle, Clock, X, Save, Plus, Trash2, Gavel } from 'lucide-react';

interface AttorneyCase {
  id: string;
  case_id: string;
  victim_id: string;
  victim_username?: string;
  victim_avatar?: string;
  status: string;
  fee_paid: number;
  is_pro_bono: boolean;
  case_details: any;
}

interface CourtCaseDetails {
  id: string;
  reason: string;
  status: string;
  description?: string;
  evidence_url?: string;
  plaintiff_id: string;
  defendant_id: string;
  created_at: string;
  updated_at?: string;
  plaintiff?: { username: string; avatar_url: string };
  defendant?: { username: string; avatar_url: string };
}

interface AvailableCase {
  id: string;
  reason: string;
  status: string;
  plaintiff_id: string;
  defendant_id: string;
  plaintiff?: { username: string; avatar_url: string };
  defendant?: { username: string; avatar_url: string };
  created_at: string;
}

export default function AttorneyDashboard() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [activeCases, setActiveCases] = useState<AttorneyCase[]>([]);
  const [availableCases, setAvailableCases] = useState<AvailableCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'cases' | 'available'>('cases');
  const [attorneyInfo, setAttorneyInfo] = useState<any>(null);
  
  // Modal state
  const [selectedCase, setSelectedCase] = useState<AttorneyCase | null>(null);
  const [caseDetails, setCaseDetails] = useState<CourtCaseDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [attorneyNotes, setAttorneyNotes] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const isProBono = profile?.is_pro_bono;
  const attorneyFee = profile?.attorney_fee || 0;
  const earnings = activeCases.filter(c => c.is_pro_bono).length * 200;

  useEffect(() => {
    if (user) {
      fetchAttorneyData();
    }
  }, [user]);

  const fetchAttorneyData = async () => {
    try {
      setLoading(true);
      
      // Get attorney info from profile
      setAttorneyInfo({
        isProBono: profile?.is_pro_bono,
        fee: profile?.attorney_fee,
        casesCount: profile?.attorney_cases_count || 0
      });

      // Get active cases
      const { data: casesData, error: casesError } = await supabase
        .from('attorney_cases')
        .select('*')
        .eq('attorney_id', user?.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (casesError) throw casesError;

      // Get user info for victims in a separate query
      const victimIds = [...new Set((casesData || []).map(c => c.victim_id).filter(Boolean))];
      const victimMap: Record<string, any> = {};
      if (victimIds.length > 0) {
        const { data: victims } = await supabase
          .from('user_profiles')
          .select('id, username, avatar_url')
          .in('id', victimIds);
        if (victims) {
          victims.forEach(v => { victimMap[v.id] = v; });
        }
      }

      const transformedCases = (casesData || []).map((c: any) => ({
        id: c.id,
        case_id: c.case_id,
        victim_id: c.victim_id,
        victim_username: victimMap[c.victim_id]?.username || 'Unknown',
        victim_avatar: victimMap[c.victim_id]?.avatar_url,
        status: c.status,
        fee_paid: c.fee_paid,
        is_pro_bono: c.is_pro_bono,
        case_details: c.case_details
      }));

      setActiveCases(transformedCases);

      // Get available cases (cases without attorneys)
      const { data: availableData } = await supabase
        .from('court_cases')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20);

      setAvailableCases(availableData || []);
    } catch (err) {
      console.error('Error fetching attorney data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTakeCase = async (caseData: AvailableCase) => {
    if (!user) return;

    const confirmMsg = isProBono 
      ? 'Take this case as Pro Bono? You will receive 200 Troll Coins from the public pool.'
      : `Take this case for ${attorneyFee} Troll Coins?`;

    if (!confirm(confirmMsg)) return;

    try {
      // Create attorney case record
      const { error } = await supabase
        .from('attorney_cases')
        .insert({
          attorney_id: user.id,
          case_id: caseData.id,
          victim_id: caseData.plaintiff_id,
          status: 'active',
          fee_paid: isProBono ? 0 : attorneyFee,
          is_pro_bono: isProBono,
          case_details: {
            reason: caseData.reason,
            plaintiff: caseData.plaintiff?.username,
            defendant: caseData.defendant?.username,
            accepted_at: new Date().toISOString()
          }
        });

      if (error) throw error;

      // If pro bono, add 200 TC from public pool
      if (isProBono) {
        const { data: poolData } = await supabase
          .from('system_wallets')
          .select('balance')
          .eq('id', 'public_pool')
          .maybeSingle();

        if (poolData && poolData.balance >= 200) {
          await supabase
            .from('user_profiles')
            .update({ troll_coins: (profile?.troll_coins || 0) + 200 })
            .eq('id', user.id);

          await supabase
            .from('system_wallets')
            .update({ balance: poolData.balance - 200 })
            .eq('id', 'public_pool');
        }
      }

      toast.success('Case accepted!');
      fetchAttorneyData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to take case');
    }
  };

  const handleViewCase = async (caseItem: AttorneyCase) => {
    setSelectedCase(caseItem);
    setLoadingDetails(true);
    setIsModalOpen(true);
    
    // Load case details from court_cases
    try {
      const { data, error } = await supabase
        .from('court_cases')
        .select(`
          id,
          reason,
          status,
          description,
          evidence_url,
          plaintiff_id,
          defendant_id,
          created_at,
          updated_at,
          plaintiff:plaintiff_id(id, username, avatar_url),
          defendant:defendant_id(id, username, avatar_url)
        `)
        .eq('id', caseItem.case_id)
        .single();
      
      if (error) throw error;
      
      setCaseDetails(data);
      setAttorneyNotes(caseItem.case_details?.attorney_notes || '');
      setEvidence(caseItem.case_details?.evidence || []);
    } catch (err) {
      console.error('Error loading case details:', err);
      toast.error('Failed to load case details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedCase(null);
    setCaseDetails(null);
    setAttorneyNotes('');
    setEvidence([]);
    setNewEvidenceUrl('');
    setIsModalOpen(false);
  };

  const handleAddEvidence = () => {
    if (newEvidenceUrl.trim() && !evidence.includes(newEvidenceUrl.trim())) {
      setEvidence([...evidence, newEvidenceUrl.trim()]);
      setNewEvidenceUrl('');
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidence(evidence.filter((_, i) => i !== index));
  };

  const handleSaveCase = async () => {
    if (!selectedCase) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('attorney_cases')
        .update({
          case_details: {
            ...selectedCase.case_details,
            attorney_notes: attorneyNotes,
            evidence: evidence,
            last_updated: new Date().toISOString()
          }
        })
        .eq('id', selectedCase.id);

      if (error) throw error;

      // Update local state
      setActiveCases(prev => prev.map(c => 
        c.id === selectedCase.id 
          ? { ...c, case_details: { ...c.case_details, attorney_notes: attorneyNotes, evidence } }
          : c
      ));

      toast.success('Case saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save case');
    } finally {
      setSaving(false);
    }
  };

  const handleEnterCourt = () => {
    if (selectedCase?.case_id) {
      navigate(`/troll-court?case=${selectedCase.case_id}`);
      handleCloseModal();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-600/20 rounded-xl flex items-center justify-center border border-amber-500/30">
              <Briefcase className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Attorney Dashboard</h1>
              <p className="text-gray-400 text-sm">
                {isProBono ? 'Pro Bono Attorney' : `Private Attorney - ${attorneyFee} TC/case`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-2">
              <p className="text-xs text-gray-400">Active Cases</p>
              <p className="text-xl font-bold text-amber-400">{activeCases.length}</p>
            </div>
            {isProBono && (
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg px-4 py-2">
                <p className="text-xs text-gray-400">Total Earnings</p>
                <p className="text-xl font-bold text-green-400">{earnings} TC</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="w-5 h-5 text-amber-400" />
              <span className="font-semibold">Total Cases</span>
            </div>
            <p className="text-2xl font-bold">{attorneyInfo?.casesCount || activeCases.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span className="font-semibold">Pending Cases</span>
            </div>
            <p className="text-2xl font-bold">{availableCases.length}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              <span className="font-semibold">Fee per Case</span>
            </div>
            <p className="text-2xl font-bold">{isProBono ? '200 TC (Pro Bono)' : `${attorneyFee} TC`}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700 pb-2">
          <button
            onClick={() => setSelectedTab('cases')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedTab === 'cases' 
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Briefcase className="w-4 h-4 inline mr-2" />
            My Cases ({activeCases.length})
          </button>
          <button
            onClick={() => setSelectedTab('available')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedTab === 'available' 
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Available Cases ({availableCases.length})
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-amber-500 rounded-full border-t-transparent"></div>
          </div>
        ) : selectedTab === 'cases' ? (
          /* My Cases */
          activeCases.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No active cases</p>
              <button
                onClick={() => setSelectedTab('available')}
                className="text-amber-400 hover:text-amber-300 mt-2"
              >
                Browse available cases
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeCases.map((caseItem) => (
                <div key={caseItem.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                        {caseItem.victim_avatar ? (
                          <img src={caseItem.victim_avatar} alt={caseItem.victim_username} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-lg">{caseItem.victim_username}</p>
                        <p className="text-gray-400 text-sm">
                          Case: {caseItem.case_details?.reason || 'Pending'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            caseItem.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-600'
                          }`}>
                            {caseItem.status.toUpperCase()}
                          </span>
                          {caseItem.is_pro_bono && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400">
                              Pro Bono
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleViewCase(caseItem)}
                      className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-lg text-sm"
                    >
                      View Case
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Available Cases */
          availableCases.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No available cases</p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableCases.map((caseItem) => (
                <div key={caseItem.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">Plaintiff: {caseItem.plaintiff?.username || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold">Defendant: {caseItem.defendant?.username || 'Unknown'}</span>
                      </div>
                      <p className="text-gray-400 text-sm mb-2">Reason: {caseItem.reason}</p>
                      <p className="text-xs text-gray-500">
                        Filed: {new Date(caseItem.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleTakeCase(caseItem)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold"
                    >
                      {isProBono ? 'Take (Pro Bono +200TC)' : `Take (${attorneyFee} TC)`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Case Detail Modal */}
        {isModalOpen && selectedCase && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <Gavel className="w-6 h-6 text-amber-400" />
                  <div>
                    <h2 className="text-xl font-bold">Case Details</h2>
                    <p className="text-gray-400 text-sm">Case ID: {selectedCase.case_id}</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin w-8 h-8 border-2 border-amber-500 rounded-full border-t-transparent"></div>
                  </div>
                ) : caseDetails ? (
                  <div className="space-y-6">
                    {/* Case Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Plaintiff Info */}
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-500 mb-2">Plaintiff (Victim)</p>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center overflow-hidden">
                            {caseDetails.plaintiff?.avatar_url ? (
                              <img src={caseDetails.plaintiff.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-purple-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-purple-400">{caseDetails.plaintiff?.username || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">ID: {caseDetails.plaintiff_id}</p>
                          </div>
                        </div>
                      </div>

                      {/* Defendant Info */}
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-500 mb-2">Defendant</p>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-600/20 rounded-full flex items-center justify-center overflow-hidden">
                            {caseDetails.defendant?.avatar_url ? (
                              <img src={caseDetails.defendant.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-red-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-red-400">{caseDetails.defendant?.username || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">ID: {caseDetails.defendant_id}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Case Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold mb-3">Case Information</h3>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-500">Reason</p>
                            <p className="text-white">{caseDetails.reason}</p>
                          </div>
                          {caseDetails.description && (
                            <div>
                              <p className="text-sm text-gray-500">Description</p>
                              <p className="text-white">{caseDetails.description}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              caseDetails.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-600'
                            }`}>
                              {caseDetails.status.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Filed</p>
                            <p className="text-white">{new Date(caseDetails.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-3">Attorney Information</h3>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-500">Type</p>
                            <p className="text-white">{selectedCase.is_pro_bono ? 'Pro Bono' : 'Private'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Fee Paid</p>
                            <p className="text-white">{selectedCase.fee_paid} TC</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Original Evidence */}
                    {caseDetails.evidence_url && (
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-500 mb-2">Original Evidence</p>
                        <a
                          href={caseDetails.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          View Evidence
                        </a>
                      </div>
                    )}

                    {/* Attorney Evidence */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Attorney Evidence</h3>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={newEvidenceUrl}
                            onChange={(e) => setNewEvidenceUrl(e.target.value)}
                            placeholder="Enter evidence URL..."
                            className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-amber-500 focus:outline-none"
                          />
                          <button
                            onClick={handleAddEvidence}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-sm flex items-center gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            Add
                          </button>
                        </div>
                      </div>
                      {evidence.length > 0 ? (
                        <div className="space-y-2">
                          {evidence.map((url, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-700 rounded p-2">
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 text-sm truncate flex-1"
                              >
                                {url}
                              </a>
                              <button
                                onClick={() => handleRemoveEvidence(index)}
                                className="ml-2 p-1 hover:bg-red-600/20 rounded"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No additional evidence added</p>
                      )}
                    </div>

                    {/* Attorney Notes */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Attorney Notes</h3>
                      <textarea
                        value={attorneyNotes}
                        onChange={(e) => setAttorneyNotes(e.target.value)}
                        placeholder="Add your notes for this case..."
                        className="w-full h-32 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-amber-500 focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>Failed to load case details</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-700">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Close
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveCase}
                    disabled={saving}
                    className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Case
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleEnterCourt}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold flex items-center gap-2"
                  >
                    <Gavel className="w-4 h-4" />
                    Enter Court
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}