export type OrderCalculationInput = {
  sourcePriceMinor: number;
  sourceRateToKztMicros: number;
  localShippingMinor: number;
  localShippingRateToKztMicros: number;
  weightGrams: number;
  internationalRateMinorPerKg: number;
  internationalRateToKztMicros: number;
  extraCostsKztMinor: number;
  customerPriceKztMinor: number;
};

const assertNonNegativeIntegers = (values: number[]) => {
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error('Order inputs must be non-negative integers');
};

export function calculateOrder(input: OrderCalculationInput) {
  assertNonNegativeIntegers(Object.values(input));
  if (input.sourceRateToKztMicros <= 0 || input.localShippingRateToKztMicros <= 0 || input.internationalRateToKztMicros <= 0 || input.weightGrams <= 0) throw new Error('Rates and weight must be positive');
  const sourcePriceKztMinor = Math.round((input.sourcePriceMinor * input.sourceRateToKztMicros) / 1_000_000);
  const localShippingKztMinor = Math.round((input.localShippingMinor * input.localShippingRateToKztMicros) / 1_000_000);
  const shippingMinor = Math.round((input.weightGrams * input.internationalRateMinorPerKg) / 1000);
  const internationalShippingKztMinor = Math.round((shippingMinor * input.internationalRateToKztMicros) / 1_000_000);
  const totalCostKztMinor = sourcePriceKztMinor + localShippingKztMinor + internationalShippingKztMinor + input.extraCostsKztMinor;
  const profitKztMinor = input.customerPriceKztMinor - totalCostKztMinor;
  return {
    sourcePriceKztMinor,
    localShippingKztMinor,
    internationalShippingKztMinor,
    totalCostKztMinor,
    profitKztMinor,
    marginBasisPoints: input.customerPriceKztMinor === 0 ? null : Math.round((profitKztMinor * 10_000) / input.customerPriceKztMinor),
  };
}
