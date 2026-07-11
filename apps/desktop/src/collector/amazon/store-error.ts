export function safeStoreError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/Target page, context or browser has been closed|process did exit|browser.*closed/i.test(message)) return 'Store browser session ended';
  if (/captcha/i.test(message)) return 'Amazon requested CAPTCHA';
  if (/timeout|net::/i.test(message)) return 'Store temporarily unavailable';
  return 'Store import failed';
}
