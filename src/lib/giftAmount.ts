/**
 * Utility: resolve the coin amount carried in any gift-event payload row.
 * Tries explicit coin/amount fields first, then falls back to metadata.
 */
export function getGiftCoinAmount(row: any): number {
  if (!row) return 0;
  const candidates = [
    row.coins_spent,
    row.coins_amount,
    row.amount,
    row.battle_points,
    row.coin_amount,
    row.total_value,
    row.total_coins,
  ];

  for (const c of candidates) {
    const n = Number(c ?? 0);
    if (Number.isFinite(n) && n > 0) return n;
  }

  if (row.metadata) {
    const m = row.metadata;
    const metaCandidates = [
      m.coins_spent,
      m.coins_amount,
      m.amount,
      m.coin_amount,
      m.total_value,
    ];
    for (const c of metaCandidates) {
      const n = Number(c ?? 0);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }

  return 0;
}
