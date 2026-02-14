import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Shield, MapPin, AlertTriangle, Users, Gauge, Crown, UserMinus } from 'lucide-react';
import { supabase, UserRole } from '../../lib/supabase';
import RequireRole from '../../components/RequireRole';
import { toast } from 'sonner';

interface ZipRow {
  id: string;
  code: string;
  officer_id: string | null;
  lead_officer_id: string | null;
  active_stream_count: number;
  crime_score: number;
  crime_level: 'Safe' | 'Moderate' | 'High' | 'Critical';
  officer_username: string | null;
  lead_officer_username: string | null;
  active_streams: number;
  violations_last_7_days: number;
}

interface RankingRow {
  officer_id: string;
  performance_score: number;
  username?: string;
  officer_rank?: string | null;
  assigned_zip_count?: number;
  is_officer_active?: boolean;
}

interface CorruptionFlag {
  id: string;
  officer_id: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
  created_at: string;
  username?: string;
}

interface OfficerOption {
  id: string;
  username: string;
  officer_rank?: string | null;
  assigned_zip_count?: number;
  is_officer_active?: boolean;
  role?: string | null;
  is_troll_officer?: boolean;
  is_lead_officer?: boolean;
}

const crimeLevelStyles: Record<ZipRow['crime_level'], string> = {
  Safe: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300',
  Moderate: 'border-yellow-400/40 bg-yellow-500/10 text-yellow-300',
  High: 'border-orange-400/40 bg-orange-500/10 text-orange-300',
  Critical: 'border-red-400/40 bg-red-500/10 text-red-300',
};

export default function ZipGovernanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [zipRows, setZipRows] = useState<ZipRow[]>([]);
  const [rankRows, setRankRows] = useState<RankingRow[]>([]);
  const [flags, setFlags] = useState<CorruptionFlag[]>([]);
  const [officerOptions, setOfficerOptions] = useState<OfficerOption[]>([]);
  const [leadOptions, setLeadOptions] = useState<OfficerOption[]>([]);

  const [selectedZip, setSelectedZip] = useState<ZipRow | null>(null);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [zipRes, rankRes, flagRes] = await Promise.all([
        supabase.from('zip_crime_dashboard').select('*').order('code', { ascending: true }),
        supabase.from('officer_rankings').select('*').order('performance_score', { ascending: false }).limit(50),
        supabase.from('officer_corruption_flags').select('*').order('created_at', { ascending: false }).limit(50)
      ]);

      const zipData = (zipRes.data || []) as ZipRow[];
      const rankData = (rankRes.data || []) as RankingRow[];
      const flagData = (flagRes.data || []) as CorruptionFlag[];

      const officerIds = new Set<string>();
      zipData.forEach((zip) => {
        if (zip.officer_id) officerIds.add(zip.officer_id);
        if (zip.lead_officer_id) officerIds.add(zip.lead_officer_id);
      });
      rankData.forEach((row) => officerIds.add(row.officer_id));
      flagData.forEach((row) => officerIds.add(row.officer_id));

      const { data: profiles } = officerIds.size
        ? await supabase
            .from('user_profiles')
            .select('id, username, officer_rank, assigned_zip_count, is_officer_active')
            .in('id', Array.from(officerIds))
        : { data: [] as any[] };

      const profileMap = new Map<string, any>();
      (profiles || []).forEach((p) => profileMap.set(p.id, p));

      const enrichedRanks = rankData.map((row) => ({
        ...row,
        username: profileMap.get(row.officer_id)?.username || 'Unknown',
        officer_rank: profileMap.get(row.officer_id)?.officer_rank,
        assigned_zip_count: profileMap.get(row.officer_id)?.assigned_zip_count,
        is_officer_active: profileMap.get(row.officer_id)?.is_officer_active
      }));

      const enrichedFlags = flagData.map((row) => ({
        ...row,
        username: profileMap.get(row.officer_id)?.username || 'Unknown'
      }));

      setZipRows(zipData);
      setRankRows(enrichedRanks);
      setFlags(enrichedFlags);
    } catch (err) {
      console.error('Zip governance load failed:', err);
      toast.error('Failed to load zip governance');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOfficerOptions = useCallback(async () => {
    const { data: officerRows } = await supabase
      .from('user_profiles')
      .select('id, username, officer_rank, assigned_zip_count, is_officer_active, role, is_troll_officer, is_lead_officer')
      .or('role.eq.troll_officer,is_troll_officer.eq.true');

    const { data: leadRows } = await supabase
      .from('user_profiles')
      .select('id, username, officer_rank, assigned_zip_count, is_officer_active, role, is_troll_officer, is_lead_officer')
      .or('role.eq.lead_troll_officer,is_lead_officer.eq.true,officer_rank.eq.lead_officer');

    setOfficerOptions((officerRows || []) as OfficerOption[]);
    setLeadOptions((leadRows || []) as OfficerOption[]);
  }, []);

  useEffect(() => {
    loadDashboard();
    loadOfficerOptions();
  }, [loadDashboard, loadOfficerOptions]);

  const summary = useMemo(() => {
    const total = zipRows.length;
    const active = zipRows.filter((z) => z.active_stream_count > 0).length;
    const critical = zipRows.filter((z) => z.crime_level === 'Critical').length;
    const high = zipRows.filter((z) => z.crime_level === 'High').length;
    return { total, active, critical, high };
  }, [zipRows]);

  const openAssignModal = (zip: ZipRow) => {
    setSelectedZip(zip);
    setSelectedOfficerId(zip.officer_id || '');
    setSelectedLeadId(zip.lead_officer_id || '');
  };

  const handleAssign = async () => {
    if (!selectedZip) return;

    setSavingAssignment(true);
    try {
      const { data, error } = await supabase.rpc('admin_assign_zip_officers', {
        p_zip_id: selectedZip.id,
        p_officer_id: selectedOfficerId || null,
        p_lead_officer_id: selectedLeadId || null
      });

      if (error || data?.success === false) {
        throw new Error(data?.message || error?.message || 'Failed to assign officers');
      }

      toast.success('Zip assignment updated');
      setSelectedZip(null);
      await loadDashboard();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign officers');
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleSetRank = async (officerId: string, rank: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_set_officer_rank', {
        p_officer_id: officerId,
        p_rank: rank
      });

      if (error || data?.success === false) {
        throw new Error(data?.message || error?.message || 'Rank update failed');
      }

      toast.success('Officer rank updated');
      await loadDashboard();
      await loadOfficerOptions();
    } catch (err: any) {
      toast.error(err.message || 'Rank update failed');
    }
  };

  const handleSuspend = async (officerId: string) => {
    const reason = prompt('Reason for suspension?') || 'admin_suspension';
    try {
      const { data, error } = await supabase.rpc('admin_suspend_officer', {
        p_officer_id: officerId,
        p_reason: reason
      });

      if (error || data?.success === false) {
        throw new Error(data?.message || error?.message || 'Suspension failed');
      }

      toast.success('Officer suspended');
      await loadDashboard();
      await loadOfficerOptions();
    } catch (err: any) {
      toast.error(err.message || 'Suspension failed');
    }
  };

  return (
    <RequireRole roles={UserRole.ADMIN}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                <Shield className="w-6 h-6 text-indigo-200" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight font-['Space_Grotesk']">Zip Governance Command</h1>
                <p className="text-sm text-slate-300">Jurisdictions, officer ladders, and crime heat map</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-slate-400">Total Zips</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase text-slate-400">Active Zips</p>
                <p className="text-2xl font-bold">{summary.active}</p>
              </div>
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                <p className="text-xs uppercase text-red-300">Critical Zips</p>
                <p className="text-2xl font-bold text-red-200">{summary.critical}</p>
              </div>
              <div className="rounded-2xl border border-orange-400/20 bg-orange-500/10 p-4">
                <p className="text-xs uppercase text-orange-300">High Risk Zips</p>
                <p className="text-2xl font-bold text-orange-200">{summary.high}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-slate-400">Loading governance data...</div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-indigo-200" />
                      Zip Heat Map
                    </h2>
                    <span className="text-xs text-slate-400">Auto-scales every 15 live streams</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {zipRows.map((zip) => (
                      <div key={zip.id} className={`rounded-xl border p-4 ${crimeLevelStyles[zip.crime_level]}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs uppercase opacity-70">{zip.code}</p>
                            <p className="text-lg font-bold">{zip.crime_level}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase opacity-70">Crime Score</p>
                            <p className="text-xl font-bold">{zip.crime_score}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase opacity-70">Officer</p>
                            <p className="font-semibold">{zip.officer_username || 'Unassigned'}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase opacity-70">Lead</p>
                            <p className="font-semibold">{zip.lead_officer_username || 'Unassigned'}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase opacity-70">Active Streams</p>
                            <p className="font-semibold">{zip.active_streams}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase opacity-70">Violations (7d)</p>
                            <p className="font-semibold">{zip.violations_last_7_days}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => openAssignModal(zip)}
                          className="mt-4 w-full rounded-lg border border-white/20 bg-white/10 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-white/20"
                        >
                          Override Assignment
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-emerald-200" />
                      Officer Rankings
                    </h2>
                    <span className="text-xs text-slate-400">Performance score leaderboard</span>
                  </div>
                  <div className="space-y-3">
                    {rankRows.map((row, index) => (
                      <div key={row.officer_id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold">#{index + 1} {row.username}</p>
                          <p className="text-xs text-slate-400">Rank: {row.officer_rank || 'troll_officer'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{row.performance_score}</p>
                          <p className="text-[11px] text-slate-400">Zips: {row.assigned_zip_count || 0}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSetRank(row.officer_id, 'lead_officer')}
                            className="rounded-lg border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20"
                          >
                            Set Lead
                          </button>
                          <button
                            onClick={() => handleSetRank(row.officer_id, 'troll_officer')}
                            className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                          >
                            Set Troll
                          </button>
                          <button
                            onClick={() => handleSuspend(row.officer_id)}
                            className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/20"
                          >
                            Suspend
                          </button>
                        </div>
                      </div>
                    ))}
                    {rankRows.length === 0 && (
                      <p className="text-sm text-slate-400">No officer rankings yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <AlertTriangle className="w-4 h-4 text-red-200" />
                    Corruption Flags
                  </h2>
                  <div className="space-y-3">
                    {flags.map((flag) => (
                      <div key={flag.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{flag.username}</p>
                          <span className={`text-xs font-bold uppercase ${flag.severity === 'high' ? 'text-red-300' : flag.severity === 'medium' ? 'text-yellow-300' : 'text-slate-300'}`}>
                            {flag.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">{flag.reason}</p>
                        <p className="text-[11px] text-slate-500 mt-2">{new Date(flag.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                    {flags.length === 0 && (
                      <p className="text-sm text-slate-400">No flags on record.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-indigo-200" />
                    Officer Ladder
                  </h2>
                  <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-300" /> CEO</div>
                    <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-indigo-200" /> Lead Officer</div>
                    <div className="flex items-center gap-2"><UserMinus className="w-4 h-4 text-slate-300" /> Troll Officer</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedZip && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-6">
              <h3 className="text-lg font-bold mb-4">Override {selectedZip.code}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase text-slate-400">Troll Officer</label>
                  <select
                    value={selectedOfficerId}
                    onChange={(e) => setSelectedOfficerId(e.target.value)}
                    className="w-full mt-2 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {officerOptions.map((officer) => (
                      <option key={officer.id} value={officer.id}>
                        {officer.username} (zips: {officer.assigned_zip_count || 0})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-400">Lead Officer</label>
                  <select
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="w-full mt-2 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {leadOptions.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.username} (zips: {lead.assigned_zip_count || 0})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedZip(null)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={savingAssignment}
                    className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {savingAssignment ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireRole>
  );
}
