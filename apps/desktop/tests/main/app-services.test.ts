import { describe, expect, it, vi } from 'vitest';

import { startBackgroundServices } from '@/main/app-services';

describe('startBackgroundServices', () => {
  it('checks for updates and schedules the daily Amazon price scan at launch', () => {
    const scan = { start: vi.fn() };
    const updates = { start: vi.fn() };

    startBackgroundServices({ updates, scan });

    expect(updates.start).toHaveBeenCalledTimes(1);
    expect(scan.start).toHaveBeenCalledTimes(1);
  });
});
