export interface PromoCardRewardCandidate {
  id: string;
  type: 'broadcast_start' | 'broadcast_60m' | 'broadcast_240m' | 'viewer_reward' | 'share_reward';
  tokenAmount: number;
  sourceId: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface PromoCardBatchContext {
  earnedTokensToday: number;
  cardsIssuedToday: number;
  viewerTokensToday: number;
  maxTokensPerDay?: number;
  maxCardsPerDay?: number;
  maxViewerTokensPerDay?: number;
}

export interface PromoCardBatchResult {
  tokenAmount: number;
  eligibleRewards: PromoCardRewardCandidate[];
  reasonSummary: string;
}

const DEFAULTS = {
  maxTokensPerDay: 80,
  maxCardsPerDay: 4,
  maxViewerTokensPerDay: 40,
};

export function buildPromoCardBatch(
  rewards: PromoCardRewardCandidate[],
  context: PromoCardBatchContext,
): PromoCardBatchResult {
  const maxTokensPerDay = context.maxTokensPerDay ?? DEFAULTS.maxTokensPerDay;
  const maxViewerTokensPerDay = context.maxViewerTokensPerDay ?? DEFAULTS.maxViewerTokensPerDay;
  const remainingTokenBudget = Math.max(0, maxTokensPerDay - context.earnedTokensToday);
  const eligibleRewards: PromoCardRewardCandidate[] = [];
  let tokenAmount = 0;

  for (const reward of rewards) {
    if (context.earnedTokensToday >= maxTokensPerDay) {
      break;
    }

    if (reward.type === 'viewer_reward') {
      if (context.viewerTokensToday >= maxViewerTokensPerDay) {
        continue;
      }
    }

    if (tokenAmount + reward.tokenAmount > remainingTokenBudget) {
      continue;
    }

    eligibleRewards.push(reward);
    tokenAmount += reward.tokenAmount;
  }

  return {
    tokenAmount,
    eligibleRewards,
    reasonSummary: eligibleRewards.map((reward) => reward.type).join(','),
  };
}

export interface PendingShareReward {
  id: string;
  userId: string;
  shareId: string;
  shareUrl: string;
  createdAt: string;
  tokenAmount: number;
  status: 'pending' | 'eligible' | 'invalid';
}

export function createPendingShareReward(userId: string, shareId: string, shareUrl: string): PendingShareReward {
  return {
    id: `share-${shareId}`,
    userId,
    shareId,
    shareUrl,
    createdAt: new Date().toISOString(),
    tokenAmount: 10,
    status: 'pending',
  };
}

export function evaluatePendingShareReward(
  reward: PendingShareReward,
  options: { isStillValid: boolean; now: Date },
): PendingShareReward & { eligible: boolean; tokenAmount: number } {
  const eligible = options.isStillValid && reward.status !== 'invalid';
  return {
    ...reward,
    eligible,
    tokenAmount: eligible ? reward.tokenAmount : 0,
    status: eligible ? 'eligible' : 'invalid',
  };
}
