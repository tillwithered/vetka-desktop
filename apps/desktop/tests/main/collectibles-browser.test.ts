import { describe, expect, it, vi } from 'vitest';

import { DirectMattelBrowser, readStablePageContent, shouldBlockMattelResource } from '@/main/collectibles/browser';

describe('DirectMattelBrowser', () => {
  it('blocks heavy resources and exposes no proxy configuration', () => {
    expect(shouldBlockMattelResource('image')).toBe(true);
    expect(shouldBlockMattelResource('font')).toBe(true);
    expect(shouldBlockMattelResource('media')).toBe(true);
    expect(shouldBlockMattelResource('document')).toBe(false);
    expect('configureTransport' in new DirectMattelBrowser('C:/data', null)).toBe(false);
  });

  it('retries a snapshot while Mattel is still redirecting the page', async () => {
    const page = {
      content: vi.fn()
        .mockRejectedValueOnce(new Error('Unable to retrieve content because the page is navigating'))
        .mockResolvedValueOnce('<main>Monster High</main>'),
      waitForTimeout: vi.fn(async () => undefined),
    };

    await expect(readStablePageContent(page)).resolves.toBe('<main>Monster High</main>');
    expect(page.waitForTimeout).toHaveBeenCalledOnce();
  });
});
