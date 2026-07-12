export function isPriceCheckOverdue(checkedAt: string, now: string | Date = new Date()): boolean {
  const checkedTime = new Date(checkedAt).getTime();
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const age = nowTime - checkedTime;
  if (!Number.isFinite(age)) return true;
  return age > 36 * 60 * 60 * 1000;
}
