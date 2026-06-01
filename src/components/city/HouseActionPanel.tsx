import React, { useEffect } from 'react';
import {
  X,
  Home,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Hammer,
  Wrench,
  Clock,
  Zap,
  Droplets,
  Wifi,
} from 'lucide-react';
import { useHouseRaidActions } from '../../lib/hooks/useHouseRaidActions';
import { useAuthStore } from '../../lib/store';

interface HouseActionPanelProps {
  targetUserId: string;
  onClose: () => void;
  /** Whether the current user can raid */
  canRaid?: boolean;
  /** Whether the current user is the owner */
  isOwner?: boolean;
}

export default function HouseActionPanel({
  targetUserId,
  onClose,
  canRaid = false,
  isOwner = false,
}: HouseActionPanelProps) {
  const { profile } = useAuthStore();
  const {
    house,
    insurance,
    activeRaids,
    loading,
    raiding,
    repairing,
    fetchHouse,
    raidHouse,
    repairHouse,
    isRaided,
    hasInsurance,
    insuranceExpired,
  } = useHouseRaidActions();

  useEffect(() => {
    fetchHouse(targetUserId);
  }, [targetUserId, fetchHouse]);

  const isStaff = profile?.is_admin || profile?.is_troll_officer || profile?.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-lg"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl shadow-black/40 overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRaided ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                <Home className={`w-5 h-5 ${isRaided ? 'text-red-400' : 'text-emerald-400'}`} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {house ? `House #${house.id.slice(0, 8)}` : 'House'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isRaided ? '⚠️ Property Raided' : '🏠 Property Secure'}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500" />
            </div>
          ) : house ? (
            <div className="p-4 space-y-4">
              {/* House Condition */}
              <div className="rounded-xl bg-slate-800/80 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">Condition</span>
                  <span className={`text-sm font-bold ${house.condition > 70 ? 'text-green-400' : house.condition > 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {house.condition}%
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      house.condition > 70
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                        : house.condition > 30
                        ? 'bg-gradient-to-r from-yellow-500 to-amber-400'
                        : 'bg-gradient-to-r from-red-500 to-orange-400'
                    }`}
                    style={{ width: `${house.condition}%` }}
                  />
                </div>
              </div>

              {/* Insurance Status */}
              <div className="rounded-xl bg-slate-800/80 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {hasInsurance ? (
                      <ShieldCheck className="w-4 h-4 text-green-400" />
                    ) : insuranceExpired ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <ShieldX className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-xs text-slate-400">Home Insurance</span>
                  </div>
                  <span className={`text-xs font-bold ${hasInsurance ? 'text-green-400' : insuranceExpired ? 'text-yellow-400' : 'text-red-400'}`}>
                    {hasInsurance ? 'Active' : insuranceExpired ? 'Expired' : 'None'}
                  </span>
                </div>
                {insurance && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>
                      Expires: {new Date(insurance.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Utilities */}
              <div className="grid grid-cols-3 gap-2">
                <div className={`rounded-lg p-2 text-center ${house.electric_on ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-slate-800/60 border border-slate-700'}`}>
                  <Zap className={`w-4 h-4 mx-auto ${house.electric_on ? 'text-yellow-400' : 'text-slate-600'}`} />
                  <span className="text-[9px] text-slate-400 mt-1 block">Electric</span>
                </div>
                <div className={`rounded-lg p-2 text-center ${house.water_on ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-slate-800/60 border border-slate-700'}`}>
                  <Droplets className={`w-4 h-4 mx-auto ${house.water_on ? 'text-blue-400' : 'text-slate-600'}`} />
                  <span className="text-[9px] text-slate-400 mt-1 block">Water</span>
                </div>
                <div className={`rounded-lg p-2 text-center ${house.internet_on ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-slate-800/60 border border-slate-700'}`}>
                  <Wifi className={`w-4 h-4 mx-auto ${house.internet_on ? 'text-purple-400' : 'text-slate-600'}`} />
                  <span className="text-[9px] text-slate-400 mt-1 block">Internet</span>
                </div>
              </div>

              {/* Active Raids */}
              {isRaided && activeRaids.length > 0 && (
                <div className="rounded-xl bg-red-950/30 border border-red-800/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-semibold text-red-300">
                      {activeRaids.length} Active Raid{activeRaids.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {activeRaids.slice(0, 3).map((raid) => (
                      <div key={raid.id} className="text-[10px] text-red-400/70">
                        • {raid.damage_level} damage — {new Date(raid.raided_at).toLocaleTimeString()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Warnings */}
              {house.is_reposessed && (
                <div className="rounded-xl bg-red-950/30 border border-red-800/30 p-3 text-center">
                  <span className="text-xs font-semibold text-red-400">⚠️ Property Repossessed</span>
                </div>
              )}

              {house.condition <= 30 && !house.is_reposessed && (
                <div className="rounded-xl bg-yellow-950/30 border border-yellow-800/30 p-3 text-center">
                  <span className="text-xs font-semibold text-yellow-400">⚠️ House needs repair</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                {canRaid && !isOwner && !isStaff && (
                  <button
                    onClick={raidHouse}
                    disabled={raiding || (profile?.troll_coins || 0) < 100}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-900/40 disabled:text-red-400/40 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                  >
                    <Hammer className="w-4 h-4" />
                    {raiding ? 'Raiding...' : 'Raid (100 TC)'}
                  </button>
                )}
                {isOwner && isRaided && (
                  <button
                    onClick={repairHouse}
                    disabled={repairing || (profile?.troll_coins || 0) < 50}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900/40 disabled:text-blue-400/40 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                  >
                    <Wrench className="w-4 h-4" />
                    {repairing ? 'Repairing...' : 'Repair (50 TC)'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <Home className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No house found for this user</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
