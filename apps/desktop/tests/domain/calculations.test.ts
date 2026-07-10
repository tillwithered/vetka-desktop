import { describe, expect, it } from 'vitest';

import { calculateOrder } from '@/domain/calculations';

describe('calculateOrder', () => {
  it('calculates source, delivery, cost, profit, and margin with integer money', () => {
    expect(calculateOrder({ sourcePriceMinor: 2499, sourceRateToKztMicros: 514_200_000, localShippingMinor: 0, localShippingRateToKztMicros: 514_200_000, weightGrams: 720, internationalRateMinorPerKg: 1200, internationalRateToKztMicros: 514_200_000, extraCostsKztMinor: 80_000, customerPriceKztMinor: 2_490_000 })).toEqual({ sourcePriceKztMinor: 1_284_986, localShippingKztMinor: 0, internationalShippingKztMinor: 444_269, totalCostKztMinor: 1_809_255, profitKztMinor: 680_745, marginBasisPoints: 2734 });
  });

  it('rejects negative inputs and handles zero customer price', () => {
    expect(() => calculateOrder({ sourcePriceMinor: -1, sourceRateToKztMicros: 1, localShippingMinor: 0, localShippingRateToKztMicros: 1, weightGrams: 1, internationalRateMinorPerKg: 1, internationalRateToKztMicros: 1, extraCostsKztMinor: 0, customerPriceKztMinor: 0 })).toThrow();
    expect(calculateOrder({ sourcePriceMinor: 0, sourceRateToKztMicros: 1, localShippingMinor: 0, localShippingRateToKztMicros: 1, weightGrams: 1, internationalRateMinorPerKg: 0, internationalRateToKztMicros: 1, extraCostsKztMinor: 0, customerPriceKztMinor: 0 }).marginBasisPoints).toBeNull();
  });
});
