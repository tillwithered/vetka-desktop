import { describe, expect, it } from 'vitest';

import { summarizePriceHistory } from '@/domain/price-history';

describe('summarizePriceHistory', () => {
  it('ignores gaps and never turns them into zero-price points', () => {
    const result = summarizePriceHistory([
      { checkedAt: '2026-07-01T00:00:00Z', priceMinor: 3000, priceKztMinor: 1_500_000 },
      { checkedAt: '2026-07-02T00:00:00Z', priceMinor: null, priceKztMinor: null },
      { checkedAt: '2026-07-03T00:00:00Z', priceMinor: 2400, priceKztMinor: 1_200_000 },
    ]);
    expect(result.points).toHaveLength(3);
    expect(result.verifiedPoints.map((point) => point.priceMinor)).toEqual([3000, 2400]);
    expect(result).toMatchObject({ minMinor: 2400, maxMinor: 3000, averageMinor: 2700 });
  });
});
