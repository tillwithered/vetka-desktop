export type PriceHistoryPoint = {
  checkedAt: string;
  priceMinor: number | null;
  priceKztMinor: number | null;
};

export function summarizePriceHistory(points: PriceHistoryPoint[]) {
  const verifiedPoints = points.filter(
    (point): point is PriceHistoryPoint & { priceMinor: number; priceKztMinor: number } =>
      point.priceMinor !== null && point.priceKztMinor !== null,
  );
  const values = verifiedPoints.map((point) => point.priceMinor);
  return {
    points,
    verifiedPoints,
    minMinor: values.length ? Math.min(...values) : null,
    maxMinor: values.length ? Math.max(...values) : null,
    averageMinor: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
  };
}
