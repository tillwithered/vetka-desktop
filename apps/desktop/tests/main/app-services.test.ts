import { describe, expect, it, vi } from 'vitest';

import { startBackgroundServices } from '@/main/app-services';

describe('startBackgroundServices', () => {
  it('checks for application updates without starting an Amazon scan at launch', () => {
    const scan = { start: vi.fn() };
    const updates = { start: vi.fn() };

    startBackgroundServices({ updates, scan });

    expect(updates.start).toHaveBeenCalledTimes(1);
    expect(scan.start).not.toHaveBeenCalled();
  });
});
