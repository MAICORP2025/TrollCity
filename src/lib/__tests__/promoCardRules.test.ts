import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromoCardBatch, createPendingShareReward, evaluatePendingShareReward } from '../promoCardRules';

test('buildPromoCardBatch respects the daily token and viewer caps', () => {
  const batch = buildPromoCardBatch([
    { id: 'b1', type: 'broadcast_start', tokenAmount: 10, sourceId: 'stream-1' },
    { id: 'v1', type: 'viewer_reward', tokenAmount: 10, sourceId: 'stream-2' },
    { id: 'b2', type: 'broadcast_60m', tokenAmount: 20, sourceId: 'stream-3' },
  ], {
    earnedTokensToday: 70,
    cardsIssuedToday: 3,
    viewerTokensToday: 30,
  });

  assert.equal(batch.tokenAmount, 10);
  assert.equal(batch.eligibleRewards.length, 1);
  assert.deepEqual(batch.eligibleRewards.map((reward) => reward.type), ['broadcast_start']);
  assert.equal(batch.reasonSummary, 'broadcast_start');
});

test('viewer rewards stop once the daily viewer cap is reached', () => {
  const batch = buildPromoCardBatch([
    { id: 'v1', type: 'viewer_reward', tokenAmount: 10, sourceId: 'stream-1' },
  ], {
    earnedTokensToday: 0,
    cardsIssuedToday: 0,
    viewerTokensToday: 40,
  });

  assert.equal(batch.tokenAmount, 0);
  assert.equal(batch.eligibleRewards.length, 0);
});

test('share-link rewards become eligible only after validation succeeds', () => {
  const pending = createPendingShareReward('user-1', 'share-1', 'https://maitalent.fun/live/abc123');
  const valid = evaluatePendingShareReward(pending, { isStillValid: true, now: new Date('2026-07-03T01:05:00.000Z') });
  const invalid = evaluatePendingShareReward(pending, { isStillValid: false, now: new Date('2026-07-03T01:05:00.000Z') });

  assert.equal(valid.eligible, true);
  assert.equal(valid.tokenAmount, 10);
  assert.equal(invalid.eligible, false);
  assert.equal(invalid.tokenAmount, 0);
});
