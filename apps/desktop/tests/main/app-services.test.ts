import { describe, expect, it, vi } from 'vitest';

import { startBackgroundServices } from '@/main/app-services';

describe('startBackgroundServices', () => {
  it('starts updates, Amazon pricing, and collectibles independently at launch', () => {
    const scan = { start: vi.fn() };
    const collectibles = { start: vi.fn() };
    const updates = { start: vi.fn() };

    startBackgroundServices({ updates, scan, collectibles });

    expect(updates.start).toHaveBeenCalledTimes(1);
    expect(scan.start).toHaveBeenCalledTimes(1);
    expect(collectibles.start).toHaveBeenCalledTimes(1);
  });
});
