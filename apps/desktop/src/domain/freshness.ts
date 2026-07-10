export type PriceFreshness = 'fresh' | 'aging' | 'stale';

export function freshnessAt(checkedAt: string, now: string | Date = new Date()): PriceFreshness {
  const checkedTime = new Date(checkedAt).getTime();
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const age = nowTime - checkedTime;
  if (!Number.isFinite(age)) return 'stale';
  if (age <= 60 * 60 * 1000) return 'fresh';
  if (age <= 24 * 60 * 60 * 1000) return 'aging';
  return 'stale';
}
