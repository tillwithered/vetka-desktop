import { describe, expect, it, vi } from 'vitest';

import { startBackgroundServices } from '@/main/app-services';

describe('startBackgroundServices', () => {
  it('starts the catalog scanner even when the updater fails to initialize', () => {
    const scan = { start: vi.fn() };
    const updates = { start: vi.fn(() => { throw new Error('Update feed unavailable'); }) };

    startBackgroundServices({ updates, scan });

    expect(scan.start).toHaveBeenCalledTimes(1);
  });
});
