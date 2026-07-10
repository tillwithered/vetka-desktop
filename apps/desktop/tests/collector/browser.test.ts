import { describe, expect, it } from 'vitest';

import { canReuseBrowserContext } from '@/collector/browser';

describe('canReuseBrowserContext', () => {
  it('does not reuse a browser context after its browser was closed', () => {
    expect(canReuseBrowserContext({ isClosed: () => true })).toBe(false);
  });

  it('reuses a live browser context', () => {
    expect(canReuseBrowserContext({ isClosed: () => false })).toBe(true);
  });
});
