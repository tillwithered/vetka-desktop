import { describe, expect, it } from 'vitest';

import { DirectMattelBrowser, shouldBlockMattelResource } from '@/main/collectibles/browser';

describe('DirectMattelBrowser', () => {
  it('blocks heavy resources and exposes no proxy configuration', () => {
    expect(shouldBlockMattelResource('image')).toBe(true);
    expect(shouldBlockMattelResource('font')).toBe(true);
    expect(shouldBlockMattelResource('media')).toBe(true);
    expect(shouldBlockMattelResource('document')).toBe(false);
    expect('configureTransport' in new DirectMattelBrowser('C:/data', null)).toBe(false);
  });
});
