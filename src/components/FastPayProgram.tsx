import React, { useMemo } from 'react';
import {
  Zap,
  Clock,
  Shield,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Star,
  Crown,
  BadgeCheck,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '../lib/store';
import { useXPStore } from '../stores/useXPStore';
import { cn } from '../lib/utils';
import {
  getFastPayTier,
  getFastPayTierLabel,
  getFastPayTierDescription,
  getFastPayProcessingTime,
  getFastPayMaxCashouts,
  FAST_PAY_FEE_PERCENT,
  FAST_PAY_MIN_LEVEL,
  INSTANT_PAY_MIN_LEVEL,
  FAST_PAY_MIN_ACCOUNT_AGE_DAYS,
  type FastPayTier,
} from '../types/cashout';
import {
  FAST_PAY_REQUIREMENTS,
  getFastPayTierInfo,
} from '../config/coinConfig';

interface FastPayProgramProps {
  onNavigateToCashout?: () => void;
  compact?: boolean;
}

/**
 * Fast Pay Program Component
 *
 * Displays the user's current Fast Pay tier, benefits, requirements,
 * and eligibility status based on their level and account standing.
 *
 * Tier Structure:
 * - Level 1-499: Standard (Friday payouts)
 * - Level 500-999: Fast Pay (any day, 24h processing)
 * - Level 1000+: Instant Pay (instant, multiple/week, priority support)
 */
export default function FastPayProgram({ onNavigateToCashout, compact = false }: FastPayProgramProps) {
  const { profile } = useAuthStore();
  const xpStore = useXPStore();

  const userLevel = Number(xpStore.level || 1);
  const tier = getFastPayTier(userLevel);
  const tierInfo = getFastPayTierInfo(userLevel);
  const processingTime = getFastPayProcessingTime(tier);
  const maxCashouts = getFastPayMaxCashouts(tier);
  const tierDescription = getFastPayTierDescription(tier);
  const tierLabel = getFastPayTierLabel(tier);

  // Calculate days until next tier
  const levelsToNextTier = useMemo(() => {
    if (tier === 'instant') return 0;
    if (tier === 'fast_pay') return INSTANT_PAY_MIN_LEVEL - userLevel;
    return FAST_PAY_MIN_LEVEL - userLevel;
  }, [tier, userLevel]);

  // Determine if user meets safety requirements
  // In production, these would come from the backend
  const requirements = useMemo(() => {
    const accountAge = profile?.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    return {
      verifiedIdentity: !!profile?.verified_since,
      noActiveViolations: true, // Would check violations table
      accountOlderThan30Days: accountAge >= FAST_PAY_MIN_ACCOUNT_AGE_DAYS,
      goodStanding: true, // Would check community standing
      noFraudChargeback: true, // Would check fraud/chargeback history
    };
  }, [profile]);

  const unmetRequirements = useMemo(() => {
    const unmet: string[] = [];
    if (!requirements.verifiedIdentity) unmet.push('Verify your identity');
    if (!requirements.noActiveViolations) unmet.push('Resolve active violations');
    if (!requirements.accountOlderThan30Days) unmet.push(`Account must be ${FAST_PAY_MIN_ACCOUNT_AGE_DAYS} days old`);
    if (!requirements.goodStanding) unmet.push('Maintain good community standing');
    if (!requirements.noFraudChargeback) unmet.push('Resolve fraud/chargeback issues');
    return unmet;
  }, [requirements]);

  const meetsAllRequirements = unmetRequirements.length === 0;
  const isEligible = tier !== 'standard' && meetsAllRequirements;

  // Tier-specific styling
  const tierStyles = {
    standard: {
      gradient: 'from-slate-600 to-slate-700',
      border: 'border-slate-500/30',
      glow: '',
      badge: 'bg-slate-700 text-slate-300',
      icon: <Clock className="h-5 w-5 text-slate-400" />,
      accentColor: 'text-slate-300',
      progressColor: 'bg-slate-500',
    },
    fast_pay: {
      gradient: 'from-cyan-500 to-blue-600',
      border: 'border-cyan-400/30',
      glow: 'shadow-[0_0_30px_rgba(34,211,238,0.15)]',
      badge: 'bg-cyan-900/60 text-cyan-300 border-cyan-500/30',
      icon: <Zap className="h-5 w-5 text-cyan-300" />,
      accentColor: 'text-cyan-300',
      progressColor: 'bg-cyan-500',
    },
    instant: {
      gradient: 'from-amber-400 via-yellow-500 to-orange-500',
      border: 'border-amber-400/30',
      glow: 'shadow-[0_0_30px_rgba(255,215,0,0.2)]',
      badge: 'bg-amber-900/60 text-amber-300 border-amber-500/30',
      icon: <Crown className="h-5 w-5 text-amber-300" />,
      accentColor: 'text-amber-300',
      progressColor: 'bg-amber-500',
    },
  };

  const style = tierStyles[tier];

  // Progress to next tier (0-100)
  const progressPercent = useMemo(() => {
    if (tier === 'instant') return 100;
    if (tier === 'fast_pay') {
      const range = INSTANT_PAY_MIN_LEVEL - FAST_PAY_MIN_LEVEL;
      const progress = userLevel - FAST_PAY_MIN_LEVEL;
      return Math.min(100, Math.max(0, (progress / range) * 100));
    }
    const range = FAST_PAY_MIN_LEVEL - 1;
    const progress = userLevel - 1;
    return Math.min(100, Math.max(0, (progress / range) * 100));
  }, [tier, userLevel]);

  if (compact) {
    return (
      <div
        className={cn(
          'rounded-2xl border bg-slate-950/65 backdrop-blur-xl p-4 transition-all',
          style.border,
          style.glow
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br', style.gradient)}>
              {style.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-bold', style.accentColor)}>{tierLabel}</span>
                {isEligible && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
              </div>
              <p className="text-xs text-slate-500">{processingTime}</p>
            </div>
          </div>
          {onNavigateToCashout && tier !== 'standard' && (
            <button
              onClick={onNavigateToCashout}
              className="flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 transition-colors"
            >
              Request <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-[2rem] border bg-slate-950/70 backdrop-blur-2xl overflow-hidden transition-all',
        style.border,
        style.glow
      )}
    >
      {/* Header */}
      <div className={cn('bg-gradient-to-r p-5', style.gradient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              {style.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white">{tierLabel}</h3>
                <span className={cn('rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', style.badge)}>
                  Level {userLevel}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-white/70">{tierDescription}</p>
            </div>
          </div>
          {isEligible && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active
            </div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Benefits Grid */}
        <div>
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Your Benefits</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <BenefitCard
              icon={<Clock className="h-4 w-4" />}
              label="Processing"
              value={processingTime}
              active={true}
            />
            <BenefitCard
              icon={<Zap className="h-4 w-4" />}
              label="Cashout Fee"
              value={`${FAST_PAY_FEE_PERCENT}%`}
              active={true}
            />
            <BenefitCard
              icon={<Star className="h-4 w-4" />}
              label="Max Per Week"
              value={`${maxCashouts}×`}
              active={tier !== 'standard'}
            />
          </div>
        </div>

        {/* Tier Comparison */}
        <div>
          <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Payout Tiers</h4>
          <div className="space-y-2">
            <TierRow
              label="Level 1–499"
              description="Standard • Paid every Friday"
              fee={`${FAST_PAY_FEE_PERCENT}%`}
              active={tier === 'standard'}
              current={tier === 'standard'}
            />
            <TierRow
              label="Level 500–999"
              description="Fast Pay • Every 24 Hrs • Within 24h"
              fee={`${FAST_PAY_FEE_PERCENT}%`}
              active={tier === 'fast_pay'}
              current={tier === 'fast_pay'}
              highlight
            />
            <TierRow
              label="Level 1000+"
              description="Instant • Every 60 Minutes • Priority"
              fee={`${FAST_PAY_FEE_PERCENT}%`}
              active={tier === 'instant'}
              current={tier === 'instant'}
              highlight
            />
          </div>
        </div>

        {/* Progress to Next Tier */}
        {tier !== 'instant' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">
                Progress to {tier === 'standard' ? 'Fast Pay' : 'Instant Pay'}
              </span>
              <span className={cn('text-xs font-bold', style.accentColor)}>
                {levelsToNextTier} level{levelsToNextTier !== 1 ? 's' : ''} to go
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', style.progressColor)}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Safety Requirements (only show for Fast Pay+ tiers) */}
        {tier !== 'standard' && (
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Safety Requirements
            </h4>
            <div className="space-y-2">
              {FAST_PAY_REQUIREMENTS.map((req) => {
                const met = (() => {
                  switch (req.key) {
                    case 'verified_identity': return requirements.verifiedIdentity;
                    case 'no_violations': return requirements.noActiveViolations;
                    case 'account_age': return requirements.accountOlderThan30Days;
                    case 'good_standing': return requirements.goodStanding;
                    case 'no_fraud': return requirements.noFraudChargeback;
                    default: return false;
                  }
                })();

                return (
                  <div
                    key={req.key}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                      met
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : 'border-red-500/20 bg-red-500/5'
                    )}
                  >
                    {met ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold', met ? 'text-emerald-300' : 'text-red-300')}>
                        {req.label}
                      </p>
                      <p className="text-xs text-slate-500">{req.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Locked State for Standard Tier */}
        {tier === 'standard' && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 text-center">
            <Lock className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm font-bold text-slate-400">
              Reach Level {FAST_PAY_MIN_LEVEL} to unlock Fast Pay
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Earn XP by streaming, receiving gifts, and participating in city activities.
            </p>
            {levelsToNextTier > 0 && (
              <p className={cn('mt-2 text-sm font-bold', style.accentColor)}>
                {levelsToNextTier} level{levelsToNextTier !== 1 ? 's' : ''} away
              </p>
            )}
          </div>
        )}

        {/* Action Button */}
        {isEligible && onNavigateToCashout && (
          <button
            onClick={onNavigateToCashout}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black transition-all',
              tier === 'instant'
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:from-amber-300 hover:to-orange-400'
                : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 hover:from-cyan-300 hover:to-blue-400'
            )}
          >
            <Zap className="h-4 w-4" />
            Request {tierLabel} Payout
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {/* Unmet Requirements Warning */}
        {tier !== 'standard' && !meetsAllRequirements && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-300">Requirements Not Met</p>
                <p className="text-xs text-slate-400 mt-1">
                  Complete the following to activate your {tierLabel} benefits:
                </p>
                <ul className="mt-2 space-y-1">
                  {unmetRequirements.map((req, i) => (
                    <li key={i} className="text-xs text-amber-300/80 flex items-center gap-1.5">
                      <span className="h-1 w-1 rounded-full bg-amber-400" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function BenefitCard({
  icon,
  label,
  value,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 text-center transition-colors',
        active
          ? 'border-cyan-500/20 bg-cyan-500/5'
          : 'border-slate-700/30 bg-slate-900/50'
      )}
    >
      <div className={cn('mx-auto mb-1.5', active ? 'text-cyan-300' : 'text-slate-600')}>
        {icon}
      </div>
      <p className={cn('text-lg font-black', active ? 'text-white' : 'text-slate-500')}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function TierRow({
  label,
  description,
  fee,
  active,
  current,
  highlight,
}: {
  label: string;
  description: string;
  fee: string;
  active: boolean;
  current: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-xl border p-3 transition-colors',
        current
          ? 'border-cyan-400/30 bg-cyan-400/10'
          : highlight
          ? 'border-slate-600/30 bg-slate-800/50'
          : 'border-slate-700/20 bg-slate-900/30'
      )}
    >
      <div className="flex items-center gap-3">
        {current ? (
          <BadgeCheck className="h-5 w-5 text-cyan-300" />
        ) : (
          <div className={cn('h-5 w-5 rounded-full border-2', active ? 'border-cyan-400 bg-cyan-400/20' : 'border-slate-600')} />
        )}
        <div>
          <p className={cn('text-sm font-bold', current ? 'text-cyan-200' : 'text-slate-400')}>{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <span className={cn('text-sm font-bold', current ? 'text-cyan-300' : 'text-slate-500')}>
        {fee} fee
      </span>
    </div>
  );
}
