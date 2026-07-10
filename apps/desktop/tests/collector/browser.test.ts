import { describe, expect, it } from 'vitest';

import { canReuseBrowserContext, shouldRetryNavigationError } from '@/collector/browser';

describe('canReuseBrowserContext', () => {
  it('does not reuse a browser context after its browser was closed', () => {
    expect(canReuseBrowserContext({ isClosed: () => true })).toBe(false);
  });

  it('reuses a live browser context', () => {
    expect(canReuseBrowserContext({ isClosed: () => false })).toBe(true);
  });
});

describe('shouldRetryNavigationError', () => {
  it('retries a transient detached-frame navigation once', () => {
    expect(shouldRetryNavigationError(new Error('page.goto: net::ERR_ABORTED; maybe frame was detached?'))).toBe(true);
  });

  it('does not retry an unrelated browser error', () => {
    expect(shouldRetryNavigationError(new Error('page.goto: net::ERR_NAME_NOT_RESOLVED'))).toBe(false);
  });
});
