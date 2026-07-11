import { describe, expect, it } from 'vitest';

import { safeStoreError } from '@/collector/amazon/store-error';

describe('safeStoreError', () => {
  it('does not leak Chromium command lines when the browser session is closed', () => {
    const raw = new Error('browserType.launchPersistentContext: Target page, context or browser has been closed Browser logs: <launching> C:\\Vetka\\chrome.exe --disable-background-networking');

    expect(safeStoreError(raw)).toBe('Store browser session ended');
    expect(safeStoreError(raw)).not.toContain('chrome.exe');
  });

  it('maps blocked and temporary Store failures to concise messages', () => {
    expect(safeStoreError(new Error('net::ERR_ABORTED'))).toBe('Store temporarily unavailable');
    expect(safeStoreError(new Error('CAPTCHA challenge'))).toBe('Amazon requested CAPTCHA');
  });
});
